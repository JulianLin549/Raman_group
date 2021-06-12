const express = require('express'),
    router = express.Router(),
    log = require('../../modules/logger'),
    User = require('../../models/user'),
    passport = require('passport'),
    JWT = require('jsonwebtoken'),
    config = require('../../config/golbal-config'),
    mongoose = require('mongoose'),
    axios = require('axios'),
    middleware = require('../../middleware/checkAuth'),
    response = require('../../modules/responseMessage'),
    log = require('../../modules/logger');


const signToken = async (user) => {
    return await JWT.sign({
        iss: 'Taiwan Ramen-Club',
        sub: user._id,
        iat: new Date().getTime(), // current time
        exp: new Date(new Date().getTime() + config.JWT_MAX_AGE).getTime()
    }, process.env.JWT_SIGNING_KEY, {algorithm: config.JWT_SIGNING_ALGORITHM});
}

router.post('/oauth/facebook', passport.authenticate('facebookToken'),
    async (req, res) => {
        if (req.user.err) {
            response.unAuthorized(res, req.user.err.message);
        } else if (req.user) {
            // Generate token
            const token = await signToken(req.user);
            res.cookie('access_token', token, {maxAge: 900000, httpOnly: true});
            response.success(res, {user: req.user, token})
        } else {
            response.unAuthorized(res, "臉書登入失敗");
        }
    }, (error, req, res, next) => {
        if (error) {
            log.error(error)
            response.badRequest(res, error);
        }
    }
)

router.get('/userInfo', middleware.jwtAuth,
    async (req, res, next) => {
        try {
            if (req.user) {
                let {password, __v, ...user} = req.user._doc; //remove password and other sensitive info from user object
                response.success(res, user);
            }
            response.notFound(res, "找不到使用者");
        } catch (error) {
            log.error(error)
            return response.internalServerError(res, error.message);
        }
    });

router.get('/unReadNotiCount', middleware.jwtAuth,
    async (req, res, next) => {
        try {
            if (req.user) {
                const userNotificationCount = await User.aggregate([
                    {$match: {_id: new mongoose.Types.ObjectId(req.user._id)}},
                    {$lookup: {from: 'notifications', localField: 'notifications', foreignField: '_id', as: 'notiArr'}},
                    {
                        $project: {
                            "count": {
                                "$size": {
                                    "$filter": {
                                        "input": "$notiArr",
                                        "cond": {"$eq": ["$$this.isRead", false]}
                                    }
                                }
                            }
                        }
                    },
                    {$limit: 1}
                ])
                const count = userNotificationCount[0]?.count;
                response.success(res, count);
            } else {
                response.notFound(res, "找不到使用者");
            }
        } catch (error) {
            log.error(error);
            return response.internalServerError(res, error.message);
        }
    });


router.get('/notifications', middleware.jwtAuth, async (req, res, next) => {
    try {
        let perPage = 9;
        let pageQuery = parseInt(req.query.page);
        let pageNumber = pageQuery ? pageQuery : 1;

        if (req.user) {
            let user = await User.findById(req.user._id).populate({
                path: 'notifications',
                options: {
                    skip: (perPage * pageNumber) - perPage,
                    limit: perPage,
                    sort: {createdAt: -1}
                }
            }).exec();

            const count = req.user.notifications.length;

            response.success(res, {
                notifications: user.notifications,
                current: pageNumber,
                pages: Math.ceil(count / perPage),
            });

            for (let notification of user.notifications) {
                notification.isRead = true;
                await notification.save();
            }

            return null;
        } else {
            response.notFound(res, "找不到使用者");
        }
    } catch (error) {
        log.error(error);
        return response.internalServerError(res, error.message);
    }
});

router.get('/followedStore', middleware.jwtAuth, async (req, res, next) => {

    try {
        let perPage = 9;
        let pageQuery = parseInt(req.query.page);
        let pageNumber = pageQuery ? pageQuery : 1;

        if (req.user) {
            const foundUser = await User.aggregate([
                {$match: {_id: new mongoose.Types.ObjectId(req.user._id)}},
                {
                    $lookup: {
                        from: "stores",
                        let: {"followedStore": "$followedStore"},
                        pipeline: [
                            {$match: {$expr: {$in: ["$_id", "$$followedStore"]}}},
                            {
                                $lookup: {
                                    "from": 'storerelations',
                                    "localField": '_id',
                                    "foreignField": 'storeId',
                                    "as": 'storeRelations'
                                }
                            },
                            {$unwind: {path: "$storeRelations", preserveNullAndEmptyArrays: true}},
                            {$sort: {"updatedAt": -1}}
                        ],
                        as: "followedStore"
                    }
                },
                {$project: {followedStore: 1}},
                {$limit: 1}
            ])

            const count = req.user.followedStore.length;

            return response.success(res, {
                stores: foundUser[0].followedStore,
                current: pageNumber,
                pages: Math.ceil(count / perPage),
            });
        } else {
            return response.notFound(res, "找不到使用者");
        }

    } catch (error) {
        log.error(error);
        return response.internalServerError(res, error.message);
    }
});


router.get('/reviewedStore', middleware.jwtAuth, async (req, res, next) => {

    try {
        let perPage = 9;
        let pageQuery = parseInt(req.query.page);
        let pageNumber = pageQuery ? pageQuery : 1;

        if (req.user) {
            const foundUser = await User.aggregate([
                {$match: {_id: new mongoose.Types.ObjectId(req.user._id)}},
                {
                    $lookup: {
                        from: "reviews",
                        let: {"reviews": "$reviews"},
                        pipeline: [
                            {"$match": {"$expr": {"$in": ["$_id", "$$reviews"]}}},
                            {
                                "$lookup": {
                                    "from": 'stores',
                                    "localField": 'store',
                                    "foreignField": '_id',
                                    "as": 'store'
                                }
                            },
                            {"$unwind": {path: "$store", preserveNullAndEmptyArrays: true}},
                            {"$sort": {"updatedAt": -1}}
                        ],
                        "as": "reviews"
                    }
                },
                {$project: {reviews: 1}},
                {$limit: 1}
            ])

            const count = req.user.reviews.length;

            return response.success(res, {
                reviews: foundUser[0].reviews,
                current: pageNumber,
                pages: Math.ceil(count / perPage),
            });
        } else {
            return response.notFound(res, "找不到使用者");
        }

    } catch (error) {
        log.error(error);
        return response.internalServerError(res, error.message);
    }
});

router.get('/isUserInRamenGroup', passport.authenticate('facebookToken', {session: false}),
    async (req, res) => {
        let isUserInGroup = false;
        try {
            let response = await axios.get(`https://graph.facebook.com/v10.0/${req.user.fbUid}/groups?pretty=0&admin_only=false&limit=10000&access_token=${req.user.fbToken}`)
            let groupsList;
            log.info(response.data)
            if (!response.data.paging.next) {
                groupsList = response.data.data;
            }

            if (groupsList.length > 0) {
                isUserInGroup = groupsList.some(group => {
                    return group.id === "1694931020757966"
                })
            }
        } catch (err) {
            log.error(error);
            isUserInGroup = true;
        }
        response.success(res, {isUserInGroup});
    });

module.exports = router