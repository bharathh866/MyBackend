import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import { uploadonCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import { response } from "express";
import mongoose from "mongoose";


const generateAccessandRefreshtokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

    } catch (error) {
        console.log(error);

        throw new ApiError(500, "Something went wrong")
    }
}
const registerUser = asyncHandler(async (req, res) => {
    const { fullname, email, username, password } = req.body
    console.log("email: ", email);
    console.log(req.body);

    if (fullname === "") {
        throw new ApiError(400, "Fullname cant be Empty")
    }
    if ([fullname, email, username, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All field s are compulsary and required")
    }

    if (email.indexOf("@") == -1) {
        throw new ApiError(400, "Invalid Email")
    }
    const Existinguser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (Existinguser) {
        throw new ApiError(409, "User with email or username already Exists")
    }
    const avatarLocalpath = req.files?.avatar[0]?.path
    // const coverLocalpath = req.files?.coverImage[0]?.path
    let coverLocalpath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverLocalpath = req.files?.coverImage[0]?.path
    }

    if (!avatarLocalpath) {
        throw new ApiError(400, "Avatar file is required")
    }
    console.log(avatarLocalpath);

    const avatar = await uploadonCloudinary(avatarLocalpath)
    console.log(avatar);

    const coverImage = await uploadonCloudinary(coverLocalpath)
    console.log(coverImage);

    if (!avatar) {
        throw new ApiError(400, "Avatar File is required")
    }

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()

    })
    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }
    return res.status(201).json(
        new ApiResponse(200, createdUser, "USER registered successfully")
    )
})
const loginUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body
    if (!(username || email)) {
        throw new ApiError(400, "username or email is required")
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (!user) {
        new ApiError(404, "User doesnt exists")

    }
    console.log("Hashed password in DB:", user.password);
    const ispasswordvalid = await user.isPasswordCorrect(password)
    console.log(password);

    if (!ispasswordvalid) {
        throw new ApiError(401, "Invalid user Credentials")
    }
    const { accessToken, refreshToken } = await generateAccessandRefreshtokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200).cookie("accessToken", accessToken, options).cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in Successfully"
        ))


})
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    }
    return res.status(200).clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiError(200, {}, "User logged Out"))
})
const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingrefreshToken = req.cookies.refreshToken || req.body.refreshToken
    console.log("irt", incomingrefreshToken);

    if (!incomingrefreshToken) {
        throw new ApiError(401, "unauthorized Access")
    }
    try {
        const decodedToken = jwt.verify(incomingrefreshToken, process.env.REFRESH_TOKEN_SECRET)
        console.log("dt", decodedToken);

        const user = await User.findById(decodedToken._id)
        console.log("userr", user);

        if (!user) {
            throw new ApiError(401, "Invalid refresh Token")
        }

        if (incomungrefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Invalid refresh expired")

        }
        const options = {
            httpOnly: true,
            secure: true
        }

        const { accessToken, newrefreshToken } = await generateAccessandRefreshtokens(user._id)
        res.status(200).cookie("accessToken", accessToken)
            .cookie("refreshToken", newrefreshToken).
            json(new ApiResponse(200,
                { accessToken, refreshToken: newrefreshToken },
                "Access token refreshed successfully"

            ))
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh Token")
    }
})
const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword, newPassword)
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid password")
    }
    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res
        .status(200)
        .json(new Apiresponse(200, {}, "Password changed successfully"))
})
const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "current user fetched successfully"))
})
const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body

    if (!fullname || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id, {
        $set: {
            fullName,
            email: email
        }
    },
        { new: true }
    ).select("-password")
    return res.status(200).json(new ApiResponse(200, user, "Account details updated successfully"))
})
const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarlocalpath = req.file?.path
    if (!avatarlocalpath) {
        throw new ApiError(400, "Avatar is required")
    }
    const avatar = await uploadonCloudinary(avatarlocalpath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading error")
    }
    const user = await User.findByIdAndUpdate(
        req.user?.id,
        {
            $set: {
                avatar: avatar.url
            }
        }, { new: true }
    )
    return res.status(200)
        .json(new ApiResponse(200, user, "Avatar updated successfully"))
}
)
const updatecoverImage = asyncHandler(async (req, res) => {
    const coverimagelocalpath = req.file?.path
    if (!coverimagelocalpathh) {
        throw new ApiError(400, "coverImage is required")
    }
    const avatar = await uploadonCloudinary(coverimagelocalpath)

    if (!coverimagelocalpath.url) {
        throw new ApiError(400, "Error while uploading cover Image")
    }
    const user = await User.findByIdAndUpdate(
        req.user?.id,
        {
            $set: {
                coverImage: coverImage.url
            }
        }, { new: true }
    )
    return res.status(200)
        .json(new ApiResponse(200, user, "cover Image updated successfully"))
}
)
const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params
    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscription",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },{
            $lookup:{
                from:"subscription",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"

            }
        },{
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"
                },
                channelsSubscribedtocount:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in :[req.user?._id,"$subscribers.subscriber"]}
   ,                     then:true,
                         else:false
                    }
                }
            }
        },{
            $project:{
                fullname:1,
                username:1,
                 subscribersCount:1,
                     channelsSubscribedtocount:1,
                       isSubscribed:1,
                       avatar:1,
                       coverImage:1,
                       email:1
            }
        }

    ])

    if(!channel?.length){
        throw new ApiError(400,"Channel does not exist ")
    }
    return res.status(200).json(new ApiResponse(200,channel[0],"User channel fetched successfully"))
})

const getWatchHistory=asyncHandler(async(req,res)=>{
    const user=await User.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullName:1,
                                        username:1,
                                        avatar:1
                                    }
                                },
                                {
                                    $addFields:{
                                        owner:{
                                            $first:"$owner  "
                                        }
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        }
    ])
    return res.status(200)
    .json(
        new ApiResponse(200,user[0].watchHistory,"fetched watch history successfully")
    )
})
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updatecoverImage,
    getUserChannelProfile,
    getWatchHistory
}