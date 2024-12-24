const express = require('express')
const User = require("../models/userSchema")

const userAuth = (req, res, next) => {
    if (req.session.user) {
    //   console.log('User session is true');
    //   console.log(req.session.user)
  
      next();
    } else {
      console.log('User session has ended');
      res.redirect('/login');
    }
  };


const adminAuth = (req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data=>{
        if(data){
            next();
        }else{
            res.redirect("/admin/login")
        }
    })
    .catch(error=>{
        console.log("Error in admin auth middleware");
        res.status(500).send("Internal Server error")
    })
}

module.exports = {
    userAuth,
    adminAuth
}