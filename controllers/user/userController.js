
const User = require('../../models/userSchema')
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const nodemailer=require('nodemailer')
const env=require('dotenv').config();
const bcrypt = require('bcrypt')

const pageNotFound=async(req,res)=>{
    try{
        res.render('page-404')
    }catch(error){
        res.redirect('/pageNotFound')

    }
}

const loadHomepage = async (req, res) => {
    try {
        // Pass the user data from the session to the view
        const user = req.session.user;
        const trendingProducts = await Product.find({ isDeleted: false })
        .sort({ views: -1 })
        .limit(8);
        
        return res.render("home", { user,trendingProducts });
    } catch (error) {
        console.error("Home page not found", error);
        res.status(500).send("Server error");
    }
};


const loadSignup = async(req,res)=>{
    try{
        return res.render('signup');
    }catch(error){
        console.log("Home page not loading:",error);
        res.status(500).send('Server Error')
        
    }
}

function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString();
}
async function sendVerificationEmail(email,otp){
    try{
        const transporter = nodemailer.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })
        const info = await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Verify your account",
            text:`Your OTP is ${otp}`,
            html:`<b>Your OTP: ${otp}</b>`
        })

        return info.accepted.length >0
    }catch(error){
        console.error("Error sending email",error);
        return false
        
    }
}


const signup = async (req,res)=>{
    try{
        const {name,phone,email,password,cPassword}=req.body;
        if(password !== cPassword){
            return res.render("signup",{message:"Password do not match"})
        }
        const findUser = await User.findOne({email});
        if(findUser){
            return res.render("signup",{message:"Email already exist"})
        }
        const otp = generateOtp();
        const emailSend = await sendVerificationEmail(email,otp);
        if(!emailSend){
            return res.json("email-error")
        }
        req.session.userOtp = otp;
        req.session.userData={name,phone,email,password};

        res.render("verify-otp")
        console.log("OTP Send:",otp);
        
    }catch(error){
        console.error("signup error",error);
        res.redirect("/pageNotFound")
    }
}

const loadLogin = async(req,res)=>{
    try{
        if(!req.session.user){
            return res.render("login")
        }else{
            res.redirect("/")
        }
    }catch(error){
        res.redirect("/pageNotFound")
        
    }
}

const login = async(req,res)=>{
    
    try {
        const user = req.session.user;
        const {email,password} = req.body;
        const findUser = await User.findOne({isAdmin:0,email:email});
        if(!findUser){
            return res.render("login",{message:"User not found"})
        }
        if(findUser.isBlocked){
            return res.render("login",{message:"User is blocked by Admin"})
        }

        const passwordMatch = await bcrypt.compare(password,findUser.password);
        if(!passwordMatch){
            return res.render("login",{message:"Incorrect Password"})
        }
        req.session.user = { id: findUser._id, name: findUser.name };
        res.redirect("/")
    } catch (error) {
        console.error("Login error",error);
        res.render("login",{message:"Login failed.please try again later"})
    }
}

const securePassword = async (password)=>{
    try {
        const passwordHash = await bcrypt.hash(password,10)
        return passwordHash
    } catch (error) {
        
    }
}

const verifyOtp = async (req,res)=>{
    try {
        const {otp}=req.body;
        console.log(otp)

        if(otp===req.session.userOtp){
            const user = req.session.userData
            const passwordHash = await securePassword(user.password)
            const saveUserData = new User({
                name:user.name,
                email:user.email,
                phone:user.phone,
                password:passwordHash,
            })
            await saveUserData.save();
            req.session.user = { id: saveUserData._id, name: saveUserData.name };
            res.json({ success: true, redirectUrl: "/", userName: saveUserData.name });
            
            
        }else{
            res.status(400).json({success:false,message:"Invalid OTP, Please try again"})
            
        }
    } catch (error) {
        console.error("Error Verifying OTP",error);
        res.status(500).json({success:false,message:"An error occured"})
        
    }
}

const resendOtp = async(req,res)=>{
    try {
        const {email} = req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }
        const otp = generateOtp();
        req.session.userOtp = otp;
        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log("Resend OTP:",otp),
            res.status(200).json({success:true,message:"OTP Resend Successfully"})
        }else{
            res.status(500).json({success:false,message:"Failed to resend OTP.Please try again"})
        }
    } catch (error) {
        console.error("Error resending OTP",error);
        res.status(500).json({success:false,message:"Internal Server Error.Please try again"})
    }
}

const logout = async (req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("Session destruction error",err.message)
                return res.redirect("/pageNotFound")
            }
            return res.redirect("/login")
        })
    } catch (error) {
        console.log("Logout error",error);
        res.redirect("/pageNotFound")
    }
}

const getForgotPassword=async(req,res)=>{
    try {
      const messages=req.flash('error')
      console.log('success')
      res.render('forgot-password',{messages})
    } catch (error) {
      console.error(error.message)
    }
  }

  const postForgotPassword=async(req,res)=>{
    try {
      const email=req.body.email.trim()
      const user=await User.findOne({email})
  
      if(!user){
        req.flash('error', 'Incorrect Email ');
              console.log('email is not found in db')
  
       return res.redirect('/forgot-password')
      }
  
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);
  
      if (!emailSent) {
          return res.json("email-error");
      }
  
      req.session.forgotOtp = otp;
      req.session.userData =   email ;
  
   //  return res.redirect('/verify-otp');
      console.log('OTP Sent', otp);
     // return res.render('forgot-otp')
  
    return  res.redirect('/forgot-otp')
  
      
    } catch (error) {
      console.log(error.message)
    }
  }
  
  const getForgotPasswordOtp=async(req,res)=>{
    try {
      res.render('forgot-otp')
    } catch (error) {
      console.error(error.message)
    }
  }
  
  
  const requestEmailChangeOtp = async (req, res) => {
    try {
      if (!req.session.user) {
        return res.redirect('/login');
      }
  
      const { newEmail } = req.body;
  
      if (!newEmail) {
        req.flash('error', 'New email is required.');
        return res.redirect('/profile');
      }
  
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(newEmail, otp);
  
      if (!emailSent) {
        req.flash('error', 'Failed to send OTP, please try again.');
        return res.redirect('/profile');
      }
  
      req.session.emailChangeOtp = otp;
      req.session.newEmail = newEmail;
  
      return res.render('verify-email-otp');
    } catch (error) {
      console.error('Error requesting email change OTP:', error.message);
      req.flash('error', 'An error occurred, please try again.');
      return res.redirect('/profile');
    }
  };
  
  const verifyEmailOtp = async (req, res) => {
    try {
      const { otp } = req.body;
  
      if (otp.toString() === req.session.emailChangeOtp.toString()) {
        const user = await User.findById(req.session.user);
  
        if (!user) {
          req.flash('error', 'User not found.');
          return res.redirect('/profile');
        }
  
        user.email = req.session.newEmail;
        await user.save();
  
        req.session.emailChangeOtp = null;
        req.session.newEmail = null;
   req.flash('error', 'Invalid OTP, please try again.');
        return res.redirect('/verify-email-otp');
        
      } else {
       req.flash('success', 'Email updated successfully!');
        return res.redirect('/profile');
      }
    } catch (error) {
      console.error('Error verifying email OTP:', error.message);
      req.flash('error', 'An error occurred, please try again.');
      return res.redirect('/verify-email-otp');
    }
  };
  
  const postForgotPasswordOtp = async (req, res) => {
    try {
      const otp = req.body.otp.trim();
  
      if (otp.toString() === req.session.forgotOtp.toString()) {
        // Clear the OTP from session after successful validation
        req.session.forgotOtp = null;
        return res.json({ success: true, message: 'OTP verified successfully!', redirectUrl: '/new-password' });
      } else {
        // OTP does not match
        return res.json({ success: false, message: 'Invalid OTP, please try again.' });
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return res.json({ success: false, message: 'An error occurred while verifying OTP, please try again.' });
    }
  };
  
  const getNewPassword=async(req,res)=>{
    try {
      res.render('new-password')
    } catch (error) {
      console.log(error.message)
    }
  }
  
  const postNewPassword=async(req,res)=>{
    try {
      const email=req.session.userData
  
      const password=req.body.password
      const confirm_password=req.body.confirm_password
  
      if(password==confirm_password){
        const newPasswordHash=await bcrypt.hash(password,10)
  
        const user=await User.updateOne({email:email},{$set:{password:newPasswordHash}})
  
  
        console.log(user,'succesfully create new password')
        return res.redirect('/login')
      }
    } catch (error) {
      console.error(error.message)
    }
  }
  
  const resendForgotPasswordOtp = async (req, res) => {
    try {
      const email = req.session.userData;
  
      if (!email) {
        return res.json({ success: false, message: 'Session expired or invalid, please try again.' });
      }
  
      const otp = generateOtp();
      req.session.forgotOtp = otp; // Update session with new OTP
  
      const emailSent = await sendVerificationEmail(email, otp);
      if (emailSent) {
        console.log('Resend OTP success', otp);
        return res.json({ success: true, message: 'OTP has been resent successfully.' });
      } else {
        console.error('Error resending OTP email');
        return res.json({ success: false, message: 'Failed to resend OTP, please try again.' });
      }
    } catch (error) {
      console.error('Error resending OTP:', error);
      return res.json({ success: false, message: 'An error occurred while resending OTP, please try again.' });
    }
  };

module.exports={
    loadHomepage,
    pageNotFound,
    loadSignup,
    signup,
    loadLogin,
    login,
    verifyOtp,
    resendOtp,
    logout,
    getForgotPassword,
    postForgotPassword,
    getForgotPasswordOtp,
    postForgotPasswordOtp,
    getNewPassword,
    postNewPassword,
    resendForgotPasswordOtp,
    requestEmailChangeOtp,
    verifyEmailOtp
}