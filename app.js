if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();

}
const express = require('express'),
    socket = require('socket.io'),
    bodyParser = require('body-parser'),
    passport = require('passport'),
    mathodOverride = require("method-override"),
    flash = require("connect-flash"),
    User = require("./models/user"),
    config = require("./config/golbal-config"),
    session = require("express-session"),
    helmet = require('helmet'),
    rateLimit = require('express-rate-limit'),
    moment = require('moment'),
    log = require('./modules/logger');
const app = express();
app.use(express.static(__dirname + '/public')) ;//dirname是你現在script跑的位置。

app.use(helmet({ contentSecurityPolicy: (process.env.NODE_ENV === 'production') ? undefined : false }));


app.use(mathodOverride("_method"));
app.use(flash());

//path
app.use('/public/images/', express.static('./public/images'));

//Passport config
require('./config/passport')(passport);

//connect DB
require("./db/connectDB");

//config email
require("./config/smtp");


//PASSPORT CONFIGURATION
app.use(session({
    cookieName: "session",
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    duration: config.SESSION_DURATION,
    activeDuration: config.SESSION_EXTENSION_DURATION,
    cookie: {
        httpOnly: true,
        ephemeral: config.SESSION_EPHEMERAL_COOKIES,
        secure: config.SESSION_SECURE_COOKIES,
    },
}));

//Passport Middleware init local strategy
app.use(passport.initialize());
app.use(passport.session());

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(express.json());
app.use(express.static("public")); //去public找東西
app.set('view engine', 'ejs'); //把ejs設訂為預設檔案。

//Global variable
//used to flash message
//can call the currentUser success_msg and error_msg from anywhere
app.use(async (req, res, next) => {
    res.locals.currentUser = req.user;
    if (req.user) {
        try {
            let user = await User.findById(req.user._id).populate('notifications', null, { isRead: false }).exec();
            res.locals.notifications = user.notifications.reverse();
        } catch (error) {
            console.log(error.message);
        }
    }
    //res.locals.error = req.flash('error');
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error'); //msg from passport.js will put error in req.flash('error)
    next();
})

moment.locale('zh-tw');
app.locals.moment = moment;

//rate limit for each ip
const limiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW,
    max: config.RATE_LIMIT, // 限制請求數量
    message: 'Too many requests, please try again later!'
})
app.use(limiter)

//Routes
//pertain the route from the index
app.use('/', require('./routes/index'));
app.use('/api/v1', require('./api/api-router'));
app.use('/auth', require('./routes/auth'));
app.use('/users', require('./routes/users'));
app.use('/stores/:id/comments', require('./routes/comments'));
app.use('/stores/:id/reviews', require('./routes/reviews'));
app.use('/stores', require('./routes/stores'));

app.get('/:else', (req, res) => {
    res.send("No such pass exist.");
})

//handle http server and socket io
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, log.info(`Server started on port ${PORT}`));
const io = socket(server);
io.on('connection', (socket) => {
    console.log('socket connection on', socket.id);
})