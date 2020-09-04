//all the middle goes here
const Store = require('../models/store');
const Comment = require('../models/comment');
const User = require('../models/user');
const Review = require("../models/review");


const middlewareObj = {}

middlewareObj.checkCommentOwnership = function(req, res, next) {
    if (req.isAuthenticated()) {

        Comment.findById(req.params.comment_id, (err, foundComment) => {
            if (err || !foundComment) {
                req.flash("error_msg", "Comment not found");
                res.redirect("back");
            } else {
                //if logged in, is he owned the store
                //foundStore.autho.id is a mongoose object
                //req.user._id is a string
                //even if they looks the same, they are essentially different,
                // so we have to use mongoose method .equals()
                if (foundComment.author.id.equals(req.user._id)) {
                    next();
                } else {
                    req.flash("error_msg", "You don't have permission to do that.");
                    res.redirect("back")
                }

            }
        });
    } else {
        res.redirect("back"); //send to where the user originally from.
    }
}


middlewareObj.checkStoreOwnership = async function(req, res, next) {
    if (req.isAuthenticated()) {
        let foundUser = await User.findById(req.user._id);

        await Store.findById(req.params.id, (err, foundStore) => {
            if (err || !foundStore) {
                req.flash("error_msg", "Store not found");
                res.redirect("back");
            } else {
                //if logged in, is he owned the store
                //foundStore.autho.id is a mongoose object
                //req.user._id is a string
                //even if they looks the same, they are essentially different,
                // so we have to use mongoose method .equals()
                if (foundUser.isAdmin || foundStore.author.id.equals(req.user._id)) {
                    next();
                } else {
                    req.flash("error_msg", "You don't have permission to do that.");
                    res.redirect("back")
                }

            }
        });
    } else {
        req.flash("error_msg", "You need to be logged in to do that.");
        res.redirect("back"); //send to where the user originally from.
    }

};


middlewareObj.checkUserOwnership = async (req, res, next) => {
    if (req.isAuthenticated()) {
        try {
            let foundUser = await User.findById(req.params.id)
            if (foundUser._id.equals(req.user._id)) {
                next();
            } else {
                req.flash("error_msg", "You are not the correct user, please log in !");
                res.redirect("/")
            }

        } catch (error) {
            console.log(error)
            req.flash('error_msg', 'You are not the correct user, please log in!')
            res.redirect("/");
        }

    } else {
        req.flash("error_msg", "You need to be logged in to do that.");
        res.redirect("/"); //send to where the user originally from.
    }

};



middlewareObj.checkReviewOwnership = function(req, res, next) {
    if (req.isAuthenticated()) {
        Review.findById(req.params.review_id, function(err, foundReview) {
            if (err || !foundReview) {
                res.redirect("back");
            } else {
                // does user own the comment?
                if (foundReview.author.id.equals(req.user._id)) {
                    next();
                } else {
                    req.flash("error", "You don't have permission to do that");
                    res.redirect("back");
                }
            }
        });
    } else {
        req.flash("error", "You need to be logged in to do that");
        res.redirect("back");
    }
};

middlewareObj.checkReviewExistence = function(req, res, next) {
    if (req.isAuthenticated()) {
        Store.findById(req.params.id).populate("reviews").exec(function(err, foundStore) {
            if (err || !foundStore) {
                req.flash("error", "Store not found.");
                res.redirect("back");
            } else {
                // check if req.user._id exists in foundStore.reviews
                var foundUserReview = foundStore.reviews.some(function(review) {
                    return review.author.id.equals(req.user._id);
                });
                if (foundUserReview) {
                    req.flash("error", "You already wrote a review.");
                    return res.redirect("/stores/" + foundStore._id);
                }
                // if the review was not found, go to the next middleware
                next();
            }
        });
    } else {
        req.flash("error", "You need to login first.");
        res.redirect("back");
    }
};

middlewareObj.isLoggedIn = function(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash("error_msg", "使用者必須登入才能檢視內容。");
    res.redirect("/");
}
module.exports = middlewareObj;