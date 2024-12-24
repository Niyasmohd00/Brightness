const Product = require('../../models/productSchema')
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema');
  

const cartLoad = async (req, res) => {
    try {
      const userId = req.session.user.id;
      const user = await User.findOne({ _id: userId });
      let cartIsEmpty = true;
  
      if (user) {
        const cart = await Cart.findOne({ userId: userId }).populate({
          path: "items.productId",
        });
        if (cart) {
          cartIsEmpty = false;
          res.render("cart", {
            cart: cart,
            userDetails: user,
            empty: cartIsEmpty,
            message: "",
          });
        } else {
          res.render("cart", {
            cart: "",
            userDetails: "",
            message: "Cart is empty",
            empty: cartIsEmpty,
          });
        }
      } else {
        res.status(400).json({ message: "User not found" });
      }
    } catch (error) {
      console.log("error loading cart :" + error);
      res.status(500).json({ message: "Internal server error" });
    }
  };


  const addToCart = async (req, res) => {
    try {
        const { productId, quantity } = req.query; 
        const userId = req.session.user.id; 
        const requestedQuantity = parseInt(quantity, 10); 
        const product = await Product.findById(productId);

        if (requestedQuantity <= 0 || product.stock < requestedQuantity) {
            req.flash('error_msg', 'Insufficient stock available.');
            return res.redirect(`/eachProduct?id=${productId}`);
        }

        let cart = await Cart.findOne({ userId });
        if (cart) {
            // Check product already exists in the cart
            const itemIndex = cart.items.findIndex(
                (item) => item.productId.toString() === productId
            );
            if (itemIndex > -1) {
                const currentQuantity = cart.items[itemIndex].quantity;
                if (currentQuantity + requestedQuantity > 5) {
                    req.flash('error_msg', 'Cannot exceed maximum quantity of 5 per item.');
                    return res.redirect(`/eachProduct?id=${productId}`);
                }
                if (product.stock < requestedQuantity + currentQuantity) {
                    req.flash('error_msg', 'Insufficient stock to add requested quantity.');
                    return res.redirect(`/eachProduct?id=${productId}`);
                }
                cart.items[itemIndex].quantity += requestedQuantity;
            } else {
                // If not, add new item to the cart
                if (requestedQuantity > 5) {
                    req.flash('error_msg', 'Cannot add more than 5 of the same item.');
                    return res.redirect(`/eachProduct?id=${productId}`);
                }
                cart.items.push({ productId, quantity: requestedQuantity });
            }
        } else {
            // If no cart create new cart
            if (requestedQuantity > 5) {
                req.flash('error_msg', 'Cannot add more than 5 of the same item.');
                return res.redirect(`/eachProduct?id=${productId}`);
            }
            if (product.stock < requestedQuantity) {
                req.flash('error_msg', 'Insufficient stock to add requested quantity.');
                return res.redirect(`/cart`);
            }
            cart = new Cart({
                userId,
                items: [{ productId, quantity: requestedQuantity }],
            });
        }
        await cart.save();

        req.flash('success_msg', 'Product added to cart successfully.');
        return res.redirect(`/eachProduct?id=${productId}`);
    } catch (error) {
        console.error('Error adding product to cart:', error);
        req.flash('error_msg', 'Internal server error.');
        return res.redirect(`/eachProduct?id=${productId}`);
    }
};

const buyNow = async (req, res) => {
    try {
        const { productId, quantity } = req.query; 
        const userId = req.session.user.id; 
        const requestedQuantity = parseInt(quantity, 10); 

        const product = await Product.findById(productId);
        if (!product) {
            req.flash('error_msg', 'Product not found.');
            return res.redirect(`/eachProduct?id=${productId}`);
        }
        if (requestedQuantity <= 0 || product.stock < requestedQuantity) {
            req.flash('error_msg', 'Insufficient stock available.');
            return res.redirect(`/eachProduct?id=${productId}`);
        }

        let cart = await Cart.findOne({ userId });
        if (cart) {
            const itemIndex = cart.items.findIndex(
                (item) => item.productId.toString() === productId
            );
            if (itemIndex > -1) {
                const currentQuantity = cart.items[itemIndex].quantity;
                if (currentQuantity + requestedQuantity > 5) {
                    req.flash('error_msg', 'Cannot exceed maximum quantity of 5 per item.');
                    return res.redirect(`/eachProduct?id=${productId}`);
                }
                if (product.stock < requestedQuantity+currentQuantity) {
                    req.flash('error_msg', 'Insufficient stock to add requested quantity to cart.');
                    return res.redirect(`/eachProduct?id=${productId}`);
                }
                cart.items[itemIndex].quantity += requestedQuantity;
            } else {
                if (requestedQuantity > 5) {
                    req.flash('error_msg', 'Cannot add more than 5 of the same item in cart.');
                    return res.redirect(`/eachProduct?id=${productId}`);
                }
                cart.items.push({ productId, quantity: requestedQuantity });
            }
        } else {
            if (requestedQuantity > 5) {
                req.flash('error_msg', 'Cannot add more than 5 of the same item.');
                return res.redirect(`/eachProduct?id=${productId}`);
            }
            cart = new Cart({
                userId,
                items: [{ productId, quantity: requestedQuantity }],
            });
        }
        await cart.save();
        req.flash('success_msg', 'Product added to cart successfully.');
        const updatedCart = await Cart.findOne({ userId }).populate('items.productId');
        return res.render('cart', { cart: updatedCart });
    } catch (error) {
        console.error('Error during buyNow:', error);
        req.flash('error_msg', 'Internal server error.');
        return res.redirect(`/eachProduct?id=${productId}`);
    }
};

  const incrementCart = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.user.id;
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            req.flash('error_msg', 'Cart not found.');
            return res.redirect('/cart');
        }
        const itemIndex = cart.items.findIndex((item) => item._id.toString() === id);
        if (itemIndex === -1) {
            req.flash('error_msg', 'Item not found in cart.');
            return res.redirect('/cart');
        }
        const product = await Product.findById(cart.items[itemIndex].productId);
        if (!product) {
            req.flash('error_msg', 'Product not found.');
            return res.redirect('/cart');
        }
        if (cart.items[itemIndex].quantity >= 5) {
          req.flash('error_msg', 'Cannot increment above 5.');
          return res.redirect('/cart');
      }
        // Check product stock to increment
        const currentQuantity = cart.items[itemIndex].quantity;
        if (product.stock < currentQuantity+1) {
            req.flash('error_msg', 'Insufficient stock to increment.');
            return res.redirect('/cart');
        }
        cart.items[itemIndex].quantity += 1;
        await cart.save();

        req.flash('success_msg', '');
        return res.redirect('/cart');
    } catch (error) {
        console.error('Error updating cart:', error);
        req.flash('error_msg', 'Internal server error.');
        return res.redirect('/cart');
    }
};


const decrementCart = async (req, res) => {
  try {
      const { id } = req.params; 
      const userId = req.session.user.id; 

      const cart = await Cart.findOne({ userId });
      if (!cart) {
          req.flash('error_msg', 'Cart not found.');
          return res.redirect('/cart');
      }
      const itemIndex = cart.items.findIndex((item) => item._id.toString() === id);
      if (itemIndex === -1) {
          req.flash('error_msg', 'Item not found in cart.');
          return res.redirect('/cart');
      }
      const product = await Product.findById(cart.items[itemIndex].productId);
      if (!product) {
          req.flash('error_msg', 'Product not found.');
          return res.redirect('/cart');
      }

      if (cart.items[itemIndex].quantity <= 1) {
          req.flash('error_msg', 'Cannot decrement below 1.');
          return res.redirect('/cart');
      }
      cart.items[itemIndex].quantity -= 1;
      await cart.save();
      req.flash('success_msg', 'Cart updated successfully.');
      return res.redirect('/cart');
  } catch (error) {
      console.error('Error updating cart:', error);
      req.flash('error_msg', 'Internal server error.');
      return res.redirect('/cart');
  }
};


  
const removeCart = async (req, res) => {
  try {
      const { id } = req.params;
      const userId = req.session.user.id; 

      const cart = await Cart.findOne({ userId });
      if (!cart) {
          req.flash('error_msg', 'Cart not found.');
          return res.redirect('/cart');
      }
      const itemIndex = cart.items.findIndex((item) => item._id.toString() === id);
      if (itemIndex === -1) {
          req.flash('error_msg', 'Item not found in cart.');
          return res.redirect('/cart');
      }
      const product = await Product.findById(cart.items[itemIndex].productId);
      if (!product) {
          req.flash('error_msg', 'Product not found.');
          return res.redirect('/cart');
      }

      // Remove the item from the cart
      cart.items.splice(itemIndex, 1);
      await cart.save();

      req.flash('success_msg', 'Item removed from cart successfully.');
      return res.redirect('/cart');
  } catch (error) {
      console.error('Error removing item from cart:', error);
      req.flash('error_msg', 'Internal server error.');
      return res.redirect('/cart');
  }
};

  
  

  module.exports = {
    cartLoad,
    addToCart,
    buyNow,
    incrementCart,
    decrementCart,
    removeCart
  }