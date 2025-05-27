import { Router } from "express"
import { verifyJWT } from "../middlewares/auth.middleware.js"
import { createTweet, deleteTweet, getUserTweets, updateTweet } from "../controllers/tweet.controller.js"
const router = Router()

router.route("/tweet").post(verifyJWT,createTweet)
router.route("/user-tweet").get(verifyJWT,getUserTweets)
router.route("/:tweetId").patch(verifyJWT,updateTweet)
router.route("/:tweetId").delete(verifyJWT,deleteTweet)

export default router
