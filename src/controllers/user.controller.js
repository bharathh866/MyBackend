import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import { uploadonCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";


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
    if(req.files &&Array.isArray(req.files.coverImage)&&req.files.coverImage.length>0){
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

    const user= await User.create({
        fullname,
        avatar: avatar.url,
        coverImage:coverImage?.url ||"",
        email,
        password,
        username: username.toLowerCase()

    })
    const createdUser=await User.findById(user._id).select("-password -refreshToken")

    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }
    return res.status(201).json(
        new ApiResponse(200,createdUser,"USER registered successfully")
    )
})

export { registerUser }