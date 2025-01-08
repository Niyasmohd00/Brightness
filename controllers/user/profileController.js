
const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema');
const bcrypt=require('bcryptjs')
const nodemailer = require('nodemailer');


const getAccount=async(req,res)=>{
    try {
        res.render('account')
    } catch (error) {
        console.error(error.message)
    }
}


const getAddressForm = async (req, res) => {
    try {
        res.render('address-form');
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
};

const getUserProfile = async (req, res) => {
    try {
        const userId = req.session.user.id; 
        if (!userId) {
            return res.status(400).send('User ID is not set in session.');
        }
        const user = await User.findById(userId); 
        const addresses = await Address.find({ userId });

        if (!user) {
            return res.status(404).send('User not found');
        }

        res.render('user-profile', {
            user,
            addresses,
        });
    } catch (error) {
        console.error('Error fetching user profile:', error.message);
        res.status(500).send('Server Error');
    }
};




function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000);
  }
  
  async function sendVerificationEmail(email, otp) {
    try {
              const transporter = nodemailer.createTransport({
                  service: 'gmail',
                  port: 587,
                  secure: false,
                  requireTLS: true,
                  auth: {
                      user: process.env.NODEMAILER_EMAIL,
                      pass: process.env.NODEMAILER_PASSWORD
                  }
              });
      
              const info = await transporter.sendMail({
                  from: process.env.NODEMAILER_EMAIL,
                  to: email,
                  subject: "Verify your account",
                  text: `Your OTP is ${otp}`,
                  html: `<b>Your OTP: ${otp}</b>`
              });
      
              return info.accepted.length > 0;
          } catch (error) {
              console.error('Error sending email', error);
              return false;
          }
  }
  
  
const editProfile = async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        const userId = req.session.user.id; 
  
        if (!userId) {
            req.flash('error_msg', 'Unauthorized');
            return res.redirect('/logout');
        }
  
        const user = await User.findById(userId);
        if (!user) {
            req.flash('error_msg', 'User not found');
            return res.redirect('/profile');
        }

        const emailInUse = await User.findOne({ email, _id: { $ne: userId } });
        if (emailInUse) {
            req.flash('error_msg', 'Email is already in use');
            return res.redirect('/profile',);
        }

        
        if (email !== user.email) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);
            console.log(otp)
            if (!emailSent) {
                req.flash('error_msg', 'Failed to send verification email. Please try again.');
                return res.redirect('/profile');
            }

            req.session.tempProfile = { name, email, phone };
            req.session.emailOtp = otp;

            return res.redirect('/verify-email-otp');
        }

        user.name = name;
        user.email = email;
        user.phone = phone;
        await user.save();

        req.flash('success_msg', 'Profile updated successfully');
        res.redirect('/profile');
    } catch (error) {
        console.error('Error updating profile:', error);
        req.flash('error_msg', 'Server error');
        res.redirect('/profile');
    }
};
const getVerifyEmailOtpPage=async(req,res)=>{
    try {
      return  res.render('verify-email')
    } catch (error) {
        console.log(error.message)
    }
}

// Function to verify OTP and update email
const verifyEmailOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const sessionOtp = req.session.emailOtp;
        const userId = req.session.user.id;

        if (!sessionOtp || otp.toString() !== sessionOtp.toString()) {
            req.flash('error_msg', 'Invalid OTP. Please try again.');
            return res.redirect('/verify-email-otp',);
        }

        const user = await User.findById(userId);
        if (!user) {
            req.flash('error_msg', 'User not found');
            return res.redirect('/profile');
        }

        // Update the user's email and other details
        const { name, email, phone } = req.session.tempProfile;
        user.name = name;
        user.email = email;
        user.phone = phone;
        await user.save();

        // Clear session data
        req.session.tempProfile = null;
        req.session.emailOtp = null;

        req.flash('success_msg', 'Email verified and profile updated successfully');
        res.redirect('/profile');
    } catch (error) {
        console.error('Error verifying OTP:', error);
        req.flash('error_msg', 'Server error');
        res.redirect('/verify-email-otp');
    }
};


  const resendEmailOtp = async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        const email = req.session.tempProfile?.email;
        
        if (!userId || !email) {
            return res.json({ success: false, message: 'Session expired or invalid, please try again.' });
        }
        
        const otp = generateOtp();
        req.session.emailOtp = otp; 
        
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



  
 const getAddress=async(req,res)=>{

    try {
        const userId = req.session.user.id; 
        const user = await User.findById(userId);
        const addresses = await Address.find({ userId });
        if (!userId) {
            return res.redirect('/login')
        }
        if (!user) {
            return res.status(404).send('User not found');
        }

        res.render('address',{addresses})


    } catch (error) {
        console.error(error.message)
    }

 }

const addAddress = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { fname, lname, housename, landmark, city, state, country, pincode, phone } = req.body;

        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const newAddress = new Address({
            userId,
            fname,
            lname,
            housename,
            landmark,
            city,
            state,
            country,
            pincode,
            phone,
        });

        await newAddress.save();

        res.redirect('/address');
    } catch (error) {
        console.error('Error saving address:', error);
        res.status(500).send('Server Error');
    }
};


const getEditAddressForm = async (req, res) => {
    try {
        const addressId = req.params.id;
        const address = await Address.findById(addressId);
        if (!address) {
            return res.status(404).send('Address not found');
        }
        res.render('edit-address', { address });
    } catch (error) {
        console.error('Error fetching address:', error.message);
        res.status(500).send('Server Error');
    }
};

const updateAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const { fname, lname, landmark, country, housename, city, state, pincode, phone } = req.body;

        const updatedAddress = await Address.findByIdAndUpdate(
            addressId,
            { fname, lname, country,landmark, housename, city, state, pincode, phone },
            { new: true }  
        );

        if (!updatedAddress) {
            return res.status(404).send('Address not found');
        }
        console.log

        res.redirect('/address'); 
    } catch (error) {
        console.error('Error updating address:', error.message);
        res.status(500).render('edit-address', { message: 'An error occurred while updating your address. Please try again.', address: req.body });
    }
};

const deleteAddress=async (req, res) => {
    console.log("checj");
    
    const addressId = req.params.id;

    try {
        const id = req.params.id;
        await Address.findByIdAndDelete(id); 
        res.status(200).json({ success: true, message: "Address deleted successfully" });
    } catch (error) {
        console.error('Error deleting address:', error);
        res.status(500).json({ success: false, message: "Failed to delete address" });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body; 
        const userId = req.session.user?.id;

        if (!userId) {
            req.flash('error_msg', 'Unauthorized');
            return res.redirect('/profile');
        }

        const user = await User.findById(userId);
        if (!user) {
            req.flash('error_msg', 'User not found');
            return res.redirect('/profile');
        }

        const isSame = await bcrypt.compare(currentPassword, user.password);
        if (!isSame) {
            req.flash('error_msg', 'Current Password is incorrect!');
            return res.redirect('/profile');
        }

        if (newPassword !== confirmPassword) {
            req.flash('error_msg', 'Confirm passwords do not match');
            return res.redirect('/profile');
        }

        if (await bcrypt.compare(newPassword, user.password)) {
            req.flash('error_msg', 'New password cannot be the same as the current password');
            return res.redirect('/profile');
        }

        // Password validation
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            req.flash(
                'error_msg',
                'Password must be at least eight characters long with uppercase, lowercase, a number, and a special character.'
            );
            return res.redirect('/profile');
        }

        const email=user.email
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        console.log(otp)
        if (!emailSent) {
            req.flash('error_msg', 'Failed to send verification email. Please try again.');
            return res.redirect('/profile');
        }

        req.session.tempPassword = { newPassword };
        req.session.emailOtp = otp;

        return res.redirect('/verify-password-otp');
    } catch (error) {
        console.error('Error changing password:', error);
        req.flash('error_msg', 'Server error');
        res.redirect('/profile');
    }
};


const getVerifyPasswordOtpPage=async(req,res)=>{
    try {
      return  res.render('verify-password')
    } catch (error) {
        console.log(error.message)
    }
}

const verifyPasswordOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const sessionOtp = req.session.emailOtp;
        const userId = req.session.user.id;

        if (!sessionOtp || otp.toString() !== sessionOtp.toString()) {
            req.flash('error_msg', 'Invalid OTP. Please try again.');
            return res.redirect('/verify-email-otp',);
        }

        const user = await User.findById(userId);
        if (!user) {
            req.flash('error_msg', 'User not found');
            return res.redirect('/profile');
        }

        // Update the user's email and other details
        const { newPassword } = req.session.tempPassword;
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        
        // Clear session data
        req.session.tempProfile = null;
        req.session.emailOtp = null;

        req.flash('success_msg', 'Password updated successfully');
        res.redirect('/profile');

    } catch (error) {
        console.error('Error verifying OTP:', error);
        req.flash('error_msg', 'Server error');
        res.redirect('/verify-email-otp');
    }
};


  const resendPasswordOtp = async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        const email = req.session.tempProfile?.email;
        
        if (!userId || !email) {
            return res.json({ success: false, message: 'Session expired or invalid, please try again.' });
        }
        
        const otp = generateOtp();
        req.session.emailOtp = otp;
        
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

const getWallet = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const user = await User.findById(userId);
        const sortedTransactions = user.walletTransactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10);

        res.render('wallet', { user, sortedTransactions });
    } catch (error) {
        console.log(error);
    }
};


const getReferral = async(req,res)=>{
    try {
        const user = await User.findById(req.session.user.id);
        res.render('referral',{user})
    } catch (error) {
        console.error(error);
    }
}

const applyReferralCode = async (req, res) => {
    try {
        const { referralCode } = req.body;
        const user = await User.findById(req.session.user.id)
        const referrer = await User.findOne({ referralCode,_id: { $ne: user._id }  });

        if (!referrer) {
            req.flash('error_msg', 'Invalid referral code. Please try again.');
            return res.redirect('/referral');
        }

        if (user.referredBy) {
            req.flash('error_msg', 'Referral code has already been applied.');
            return res.redirect('/referral');
        }
        referrer.walletBalance += 400;
        referrer.walletTransactions.push({
            date: new Date(),
            type: 'credit',
            amount: 400,
            transactionId: `TRNSID${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            description: 'Referral reward ',
        });
        user.referredBy = referrer.name;
        console.log(user.referredBy)
        await referrer.save();
        await user.save();

        req.flash('success_msg', 'Referral code applied successfully!');
        return res.redirect('/referral');
    } catch (error) {
        req.flash('error_msg', 'Something went wrong. Please try again.');
        return res.redirect('/referral');
    }
};


module.exports = {
    getAccount,
    getAddress,
    getAddressForm,
    addAddress,
    getEditAddressForm,
    updateAddress,
    deleteAddress,
    getUserProfile,
    editProfile,
    changePassword,
    verifyEmailOtp,
    getVerifyEmailOtpPage,
    resendEmailOtp,
    getVerifyPasswordOtpPage,
    verifyPasswordOtp,
    resendPasswordOtp,
    getWallet,
    getReferral,
    applyReferralCode
};