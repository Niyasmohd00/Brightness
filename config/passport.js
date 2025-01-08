const passport = require('passport');
const googleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
const env = require("dotenv").config();
const crypto = require('crypto');

const getCallbackURL = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    return isProduction
        ? "https://brightness.co.in/auth/google/callback"
        : "http://localhost:3000/auth/google/callback";
};

passport.use(new googleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: getCallbackURL(), 
},

async (accessToken,refreshToken,profile,done)=>{
    try {
        let user = await User.findOne({googleId:profile.id})
        if(user){
            return done(null,user);
        }else{
            const referralCode = await generateUniqueReferralCode();
            user = new User({
                name:profile.displayName,
                email:profile.emails[0].value,
                googleId:profile.id,
                referralCode: referralCode,
            })
            await user.save();
            return done(null,user)
        }
    } catch (error) {
        return done(error,null)
    }
}

))

passport.serializeUser((user,done)=>{
    done(null,user.id)
})

passport.deserializeUser((id, done) => {
    User.findById(id)
        .then(user => {
            if (!user) {
                console.error(`User not found with ID: ${id}`);
                return done(new Error('User not found'), null);
            }
            return done(null, user);
        })
        .catch(err => {
            console.error(`Error fetching user with ID: ${id}`, err);
            return done(err, null);
        });
});

async function generateUniqueReferralCode() {
    let code;
    let exists = true;

    while (exists) {
        code = crypto.randomBytes(4).toString('hex').toUpperCase();
        exists = await User.exists({ referralCode: code });
    }

    return code;
}

module.exports = passport