const express = require('express')
const User = require("../models/userSchema")

const userAuth = (req, res, next) => {
    if (req.session.user) {
      next();
    } else {
      console.log('User session has ended');
      res.redirect('/login');
    }
  };


  const adminAuth = (req, res, next) => {
    if (req.session && req.session.admin) {
      return next();
    } else {
      return res.redirect("/admin/login");
    }
  };
  

module.exports = {
    userAuth,
    adminAuth
}