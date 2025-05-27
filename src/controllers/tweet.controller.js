import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    
    const {content}=req.body;
    if(!content){
        throw new ApiError(400,"Empty tweet")

    }
    const twee=Tweet.create({
        content:content,
        owner:req.user
    })

return res.status(200).json(new ApiResponse(200,"Tweet saved"))
})

const getUserTweets = asyncHandler(async (req, res) => {
    
    const user=req.user._id
    const tweets=await Tweet.find({owner:user})
    console.log(user);
    
console.log(tweets);
return res.status(200).json(new ApiResponse(200,tweets,"Tweet fetched successfully"))
    
})

const updateTweet = asyncHandler(async (req, res) => {

    const {content}=req.body
    const tweetId=req.params.tweetId?.trim()
    console.log(content);
    console.log(tweetId);
    
    
    if(!content){
        throw new ApiError(400,"Tweet cant be empty")

    }
     const existingTweet = await Tweet.findOne({ _id: tweetId, owner: req.user._id });
    if (!existingTweet) {
        throw new ApiError(404, "Tweet not found or you are not authorized to update it");
    }
  existingTweet.content=content
  await existingTweet.save()
        return res.status(200).json(new ApiResponse(200,existingTweet, "Tweet updated successfully"))
    

})

const deleteTweet = asyncHandler(async (req, res) => {
    const tweetId=req.params.tweetId?.trim()

    if(!tweetId){
        throw new ApiError(400,"Tweet ID required")

    }
  await Tweet.findByIdAndDelete({_id:tweetId,owner:req.user._id})
 

        return res.status(200).json(new ApiResponse(200,"Tweet deleted successfully"))
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}