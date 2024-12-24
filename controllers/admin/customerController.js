const User = require('../../models/userSchema');

const customerInfo = async (req, res) => {
    try {
        let search = req.query.search || "";
        let page = parseInt(req.query.page) || 1; 
        const limit = 20; 
        
        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: 'i' } },
                { email: { $regex: ".*" + search + ".*", $options: 'i' } }
            ]
        })
        .limit(limit) 
        .skip((page - 1) * limit) 
        .exec();

        const count = await User.countDocuments({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: 'i' } },
                { email: { $regex: ".*" + search + ".*", $options: 'i' } }
            ]
        });
        const totalPages = Math.ceil(count / limit);

        res.render('customers', {
            data: userData,
            totalPages: totalPages,
            currentPage: page,
            search: search
        });
    } catch (error) {
        console.error("Error fetching customers:", error);
        return res.redirect("/pageerror"); 
    }
};


const blockCustomer = async (req, res) => {
    try {
        const customerId = req.params.id;
        const customer = await User.findById(customerId);
        if (customer) {
            customer.isBlocked = true; 
            await customer.save();
            res.json({ success: true });
        } else {
            res.json({ success: false, message: "Customer not found" });
        }
    } catch (error) {
        console.error("Error blocking customer:", error);
        res.json({ success: false, message: "Error blocking customer" });
    }
};


const unblockCustomer = async (req, res) => {
    try {
        const customerId = req.params.id;
        const customer = await User.findById(customerId);
        if (customer) {
            customer.isBlocked = false; 
            await customer.save();
            res.json({ success: true });
        } else {
            res.json({ success: false, message: "Customer not found" });
        }
    } catch (error) {
        console.error("Error unblocking customer:", error);
        res.json({ success: false, message: "Error unblocking customer" });
    }
};


const deleteCustomer = async (req, res) => {
    try {
        const customerId = req.params.id;
        const result = await User.findByIdAndDelete(customerId);
        if (result) {
            res.json({ success: true });
        } else {
            res.json({ success: false, message: "Customer not found" });
        }
    } catch (error) {
        console.error("Error deleting customer:", error);
        res.json({ success: false, message: "Error deleting customer" });
    }
};


const viewCustomer = async (req, res) => {
    try {
        const customerId = req.params.id;
        const customer = await User.findById(customerId);
        if (customer) {
            res.render('customerDetail', { customer });
        } else {
            res.redirect('/pageerror');
        }
    } catch (error) {
        console.error("Error viewing customer:", error);
        return res.redirect("/pageerror");
    }
};

module.exports = {
    customerInfo,
    blockCustomer,
    unblockCustomer,
    deleteCustomer,
    viewCustomer,
};
