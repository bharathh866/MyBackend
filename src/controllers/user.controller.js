import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import { uploadonCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"


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
            $set: {
                refreshToken: undefined
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
        console.log("irt",incomingrefreshToken);
        
    if (!incomingrefreshToken) {
        throw new ApiError(401, "unauthorized Access")
    }
    try {
        const decodedToken = jwt.verify(incomingrefreshToken, process.env.REFRESH_TOKEN_SECRET)
        console.log("dt",decodedToken);
        
        const user = await User.findById(decodedToken._id)
    console.log("userr",user);
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh Token")
        }
    
        if(incomungrefreshToken !==user?.refreshToken){
            throw new ApiError(401, "Invalid refresh expired")
    
        }
    const options={
        httpOnly:true,
        secure:true
    }
    
        const {accessToken,newrefreshToken}= await generateAccessandRefreshtokens(user._id)
        res.status(200).cookie("accessToken",accessToken)
        .cookie("refreshToken" ,newrefreshToken).
        json(new ApiResponse(200,
            {accessToken,refreshToken:newrefreshToken},
            "Access token refreshed successfully"
    
        ))
    } catch (error) {
        throw new ApiError(401,error?.message ||"Invalid refresh Token")
    }
})
export { registerUser, loginUser, logoutUser,refreshAccessToken }