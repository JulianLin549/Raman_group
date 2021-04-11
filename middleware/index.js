//all the middle goes here
const Store = require('../models/store');
const Comment = require('../models/comment');
const User = require('../models/user');
const Review = require("../models/review");
const userRole = require("../enums/user-role");
const log = require('../modules/logger');
const response = require('../modules/response-message');


const middlewareObj = {}

middlewareObj.checkCommentOwnership = async (req, res, next) => {
    try {
        if (req.isAuthenticated()) {
            let foundComment = await Comment.findById(req.params.comment_id);
            if (!foundComment) {
                req.flash("error_msg", "留言不存在");
                res.redirect("back");
            } else {
                if (foundComment.author.id.equals(req.user._id)) {
                    next();
                } else {
                    req.flash("error_msg", "您並沒有權限執行此操作。如果您認為這是個錯誤，請聯絡網站管理員mepowenlin@gmail.com");
                    res.redirect("back")
                }
            }
        }
    } catch (error) {
        log.error(error);
        req.flash("error_msg")
        res.redirect("back"); //send to where the user originally from.
    }





    if (req.isAuthenticated()) {

        Comment.findById(req.params.comment_id, (err, foundComment) => {
            if (err || !foundComment) {
                req.flash("error_msg", "留言不存在");
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
                    req.flash("error_msg", "您並沒有權限執行此操作。如果您認為這是個錯誤，請聯絡網站管理員mepowenlin@gmail.com");
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
                req.flash("error_msg", "店家不存在");
                res.redirect("back");
            } else {
                //if logged in, is he owned the store
                //foundStore.autho.id is a mongoose object
                //req.user._id is a string
                //even if they looks the same, they are essentially different,
                // so we have to use mongoose method .equals()
                if (foundUser.userRole == userRole.ADMIN || (foundUser.userRole == userRole.STORE_OWNER && foundStore.author.id.equals(req.user._id))) {
                    next();
                } else {
                    req.flash("error_msg", "您並沒有權限執行此操作。如果您認為這是個錯誤，請聯絡網站管理員mepowenlin@gmail.com");
                    res.redirect("back")
                }

            }
        });
    } else {
        req.flash("error_msg", "使用者必須登入才能檢視內容");
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
                req.flash("error_msg", "您並非正確的使用者，請登入");
                res.redirect("/")
            }

        } catch (error) {
            console.log(error)
            req.flash('error_msg', '您並非正確的使用者，請登入')
            res.redirect("/");
        }

    } else {
        req.flash("error_msg", "使用者必須登入才能檢視內容");
        res.redirect("/"); //send to where the user originally from.
    }

};



middlewareObj.checkReviewOwnership = async (req, res, next) => {
    try {
        if (req.isAuthenticated()) {
            let foundReview = await Review.findById(req.params.review_id);
            if (!foundReview) res.redirect("back");

            if (foundReview.author.id.equals(req.user._id)) {
                next();
            } else {
                req.flash("error_msg", "您並沒有權限執行此操作。如果您認為這是個錯誤，請聯絡網站管理員mepowenlin@gmail.com");
                res.redirect("back");
            }
        } else {
            req.flash("error_msg", "使用者必須登入才能檢視內容");
            res.redirect("back");
        }
    } catch (error) {
        log.error(error);
        res.redirect("back");
    }
};

middlewareObj.checkReviewExistence = function(req, res, next) {
    if (req.isAuthenticated()) {
        Store.findById(req.params.id).populate("reviews").exec(function(err, foundStore) {
            if (err || !foundStore) {
                req.flash("error_msg", "店家不存在");
                res.redirect("back");
            } else {
                // check if req.user._id exists in foundStore.reviews
                var foundUserReview = foundStore.reviews.some(function(review) {
                    return review.author.id.equals(req.user._id);
                });
                if (foundUserReview) {
                    req.flash("error_msg", "您已經填寫過評論了");
                    return res.redirect("/stores/" + foundStore._id);
                }
                // if the review was not found, go to the next middleware
                next();
            }
        });
    } else {
        req.flash("error_msg", "使用者必須登入才能檢視內容");
        res.redirect("back");
    }
};

middlewareObj.isLoggedIn = function(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash("error_msg", "使用者必須登入才能檢視內容");
    res.redirect("/");
}

middlewareObj.isAdmin = async (req, res, next) => {
    if (req.isAuthenticated()) {
        if (req.user.userRole !== 0) response.unAuthorized(res, "使用者非管理員，無法進行此操作！")
        next();
    } else {
        response.unAuthorized(res, "使用者必須登入才能檢視內容")
    }
}

module.exports = middlewareObj;