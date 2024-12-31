const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const Category = require('../../models/categorySchema');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');


const getDashboard = async (req, res) => {
    try {
        const currentDate = new Date();
        let month = req.query.month ? parseInt(req.query.month) : currentDate.getMonth() + 1;
        let year = req.query.year ? parseInt(req.query.year) : currentDate.getFullYear(); 
        const chartType = req.query.chartType || 'monthly';

        let startDate, endDate;

        if (chartType === 'monthly') {
            startDate = new Date(year, month - 1, 1); 
            endDate = new Date(year, month, 0); 
        } else {
            startDate = new Date(year, 0, 1); 
            endDate = new Date(year + 1, 0, 0);
        }

        const topProducts = await Order.aggregate([
            { $unwind: "$products" },
            { 
                $lookup: {
                    from: "products",
                    localField: "products.productId",
                    foreignField: "_id",
                    as: "productDetails",
                }
            },
            { $unwind: "$productDetails" },
            { $match: { createdAt: { $gte: startDate, $lte: endDate } } }, // Filter by date range
            { 
                $group: {
                    _id: "$products.productId", 
                    productName: { $first: "$productDetails.productName" }, 
                    totalSoldItems: { $sum: "$products.quantity" },
                }
            },
            { $sort: { totalSoldItems: -1 } },
            { $limit: 10 },
        ]);
        
        const topCategories = await Order.aggregate([
            { $unwind: "$products" },
            { 
                $lookup: {
                    from: "products",
                    localField: "products.productId",
                    foreignField: "_id",
                    as: "productDetails",
                }
            },
            { $unwind: "$productDetails" },
            { 
                $lookup: {
                    from: "categories",
                    localField: "productDetails.category",
                    foreignField: "_id",
                    as: "categoryDetails",
                }
            },
            { $unwind: "$categoryDetails" },
            { $match: { createdAt: { $gte: startDate, $lte: endDate } } }, // Filter by date range
            { 
                $group: {
                    _id: "$categoryDetails._id",
                    name: { $first: "$categoryDetails.name" },
                    totalSoldItems: { $sum: "$products.quantity" },
                }
            },
            { $sort: { totalSoldItems: -1 } },
            { $limit: 10 },
        ]);

        const statusData = await Order.aggregate([
            { $unwind: "$products" },
            { 
                $match: { createdAt: { $gte: startDate, $lte: endDate } } // Filter by date range
            },
            { 
                $group: {
                    _id: "$products.status", // Group by product status (Delivered, Returned, etc.)
                    count: { $sum: "$products.quantity" }
                }
            }
        ]);

        const productStatus = {
            delivered: 0,
            returned: 0,
            shipped: 0,
            pending: 0,
            processing: 0
        };

        statusData.forEach(item => {
            if (item._id === 'Delivered') productStatus.delivered = item.count;
            if (item._id === 'Returned') productStatus.returned = item.count;
            if (item._id === 'Shipped') productStatus.shipped = item.count;
            if (item._id === 'Pending') productStatus.pending = item.count;
            if (item._id === 'Processing') productStatus.processing = item.count;
        });

        res.render("dashboard", {
            topProducts,
            topCategories,
            productStatus,
            month,
            year,
            chartType
        });

    } catch (error) {
        console.error("Error fetching sales data:", error);
        res.status(500).json({ success: false, message: "Error fetching sales data." });
    }
};



const salesList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const {
            sortBy = 'updatedAt',
            startDate,
            endDate,
            filterBy = 'all',
            sortOrder = 'desc',
        } = req.query;

        const dateFilter = {};
        if (filterBy !== 'all') {
            const now = new Date();
            let filterStartDate;

            switch (filterBy) {
                case '1day':
                    filterStartDate = new Date(now.setDate(now.getDate() - 1));
                    break;
                case 'week':
                    filterStartDate = new Date(now.setDate(now.getDate() - 7));
                    break;
                case 'month':
                    filterStartDate = new Date(now.setMonth(now.getMonth() - 1));
                    break;
                case 'year':
                    filterStartDate = new Date(now.setFullYear(now.getFullYear() - 1));
                    break;
                default:
                    filterStartDate = null;
            }

            if (filterStartDate) {
                dateFilter.orderDate = { $gte: filterStartDate };
            }
        } else if (startDate || endDate) {
            dateFilter.orderDate = {};
            if (startDate) dateFilter.orderDate.$gte = new Date(startDate);
            if (endDate) dateFilter.orderDate.$lte = new Date(endDate);
        }

        const orders = await Order.find({
            'products.status': 'Delivered', 
            paymentStatus: 'Paid',
            ...dateFilter,
        })
            .populate('userId', 'name email') 
            .populate('products.productId', 'productName price category')
            .sort({ [sortBy]: sortOrder === 'desc' ? 1 : -1 })
            .limit(limit) 
            .skip((page - 1) * limit)
            .exec();

        const reportTotal = orders.reduce((total, order) => total + order.totalAmount, 0);
        const totalOrders = orders.reduce((count) => count + 1, 0);
        const discountTotal = orders.reduce((total, order) => total + order.totalDiscount, 0);
        const totalPages = Math.ceil(totalOrders / limit);

        res.render('salesReport', {
            orders,
            totalPages,
            currentPage: page,
            totalOrders,
            reportTotal,
            discountTotal,
            sortBy,
            sortOrder,
            filterBy,
            startDate,
            endDate,
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Internal Server Error');
    }
};

const downloadExcelReport = async (req, res) => {
    try {
        const { startDate, endDate, filterBy } = req.query;
        console.log(req.query);
        const dateFilter = {};
        if (filterBy !== 'all') {
            const now = new Date();
            let filterStartDate;

            switch (filterBy) {
                case '1day':
                    filterStartDate = new Date(now.setDate(now.getDate() - 1));
                    break;
                case 'week':
                    filterStartDate = new Date(now.setDate(now.getDate() - 7));
                    break;
                case 'month':
                    filterStartDate = new Date(now.setMonth(now.getMonth() - 1));
                    break;
                case 'year':
                    filterStartDate = new Date(now.setFullYear(now.getFullYear() - 1));
                    break;
                default:
                    filterStartDate = null;
            }

            if (filterStartDate) {
                dateFilter.orderDate = { $gte: filterStartDate };
            }
        } else if (startDate || endDate) {
            dateFilter.orderDate = {};
            if (startDate) dateFilter.orderDate.$gte = new Date(startDate);
            if (endDate) dateFilter.orderDate.$lte = new Date(endDate);
        }
        const orders = await Order.find({
            'products.status': 'Delivered',
            paymentStatus: 'Paid',
            ...dateFilter,
        })
            .populate('userId', 'name email')
            .populate('products.productId', 'productName price category');

        let reportStartDate = startDate;
        let reportEndDate = endDate;
        
        if (!reportStartDate || !reportEndDate) {
            const now = new Date();
            switch (filterBy) {
                case '1day':
                    reportStartDate = new Date(now.setDate(now.getDate() - 1)).toLocaleDateString();
                    reportEndDate = new Date().toLocaleDateString();
                    break;
                case 'week':
                    reportStartDate = new Date(now.setDate(now.getDate() - 7)).toLocaleDateString();
                    reportEndDate = new Date().toLocaleDateString();
                    break;
                case 'month':
                    reportStartDate = new Date(now.setMonth(now.getMonth() - 1)).toLocaleDateString();
                    reportEndDate = new Date().toLocaleDateString();
                    break;
                case 'year':
                    reportStartDate = new Date(now.setFullYear(now.getFullYear() - 1)).toLocaleDateString();
                    reportEndDate = new Date().toLocaleDateString();
                    break;
                default:
                    reportStartDate = 'Start';
                    reportEndDate = 'End';
            }
        }
        
        // Create Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        // Add a title in A1
        worksheet.getCell('A1').value = `Sales Report (${reportStartDate || 'Start'} to ${reportEndDate || 'End'})`;
        worksheet.getCell('A1').font = { bold: true, size: 16 };
        worksheet.mergeCells('A1:F1'); 

        // Add header row
        worksheet.getRow(2).values = ['Customer Name', 'Order Date', 'Product Name', 'Price', 'Quantity', 'Total', 'Discount', 'Status', 'Payment Status'];
        worksheet.getRow(2).font = { bold: true };
        worksheet.columns = [
            { key: 'customerName', width: 25 },
            { key: 'orderDate', width: 20 },
            { key: 'productName', width: 30 },
            { key: 'price', width: 15 },
            { key: 'quantity', width: 10 },
            { key: 'totalAmount', width: 15 },
            { key: 'totalDiscount', width: 15 },
            { key: 'status', width: 15 },
            { key: 'paymentStatus', width: 15 },
        ];

        let rowNum = 3;

        let no=1;
        orders.forEach(order => {
            worksheet.getRow(rowNum).values = [no+"."+order.userId.name, new Date(order.orderDate).toLocaleDateString()];
            rowNum++;
            no++;
            order.products.forEach(product => {
                worksheet.addRow({
                    productName: product.productId.productName,
                    price: product.productId.price,
                    quantity: product.quantity,
                    totalAmount: (product.productId.price * product.quantity),
                    totalDiscount: product.offerAmount,
                    status: product.status,
                    paymentStatus: order.paymentStatus,
                });
                rowNum++;
            });
            worksheet.getRow(rowNum).values = ['','',`Coupon Applied: ${order.couponDiscount}`, `Order Total: ₹${order.totalAmount}`];
            rowNum++;
            rowNum++;

        });

        // Add total summary at the end
        worksheet.addRow([]);
        worksheet.getRow(rowNum).values = [`Total Orders: ${orders.length}`, `Total Discount: ₹${orders.reduce((acc, order) => acc + order.totalDiscount, 0).toFixed(2)}`, `Total Amount: ₹${orders.reduce((acc, order) => acc + order.totalAmount, 0).toFixed(2)}`];
        worksheet.getRow(rowNum).font = { bold: true };

        // Set response headers and send the file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=SalesReport.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating Excel report:', error);
        res.status(500).send('Error generating Excel report');
    }
};



const downloadPDFReport = async (req, res) => {
    try {
        const { startDate, endDate, filterBy } = req.query;
        console.log(req.query);

        const dateFilter = {};
        if (filterBy !== 'all') {
            const now = new Date();
            let filterStartDate;

            switch (filterBy) {
                case '1day':
                    filterStartDate = new Date(now.setDate(now.getDate() - 1));
                    break;
                case 'week':
                    filterStartDate = new Date(now.setDate(now.getDate() - 7));
                    break;
                case 'month':
                    filterStartDate = new Date(now.setMonth(now.getMonth() - 1));
                    break;
                case 'year':
                    filterStartDate = new Date(now.setFullYear(now.getFullYear() - 1));
                    break;
                default:
                    filterStartDate = null;
            }

            if (filterStartDate) {
                dateFilter.orderDate = { $gte: filterStartDate };
            }
        } else if (startDate || endDate) {
            dateFilter.orderDate = {};
            if (startDate) dateFilter.orderDate.$gte = new Date(startDate);
            if (endDate) dateFilter.orderDate.$lte = new Date(endDate);
        }
        const orders = await Order.find({
            'products.status': 'Delivered',
            paymentStatus: 'Paid',
            ...dateFilter,
        })
            .populate('userId', 'name email')
            .populate('products.productId', 'productName price category');

        let reportStartDate = startDate;
        let reportEndDate = endDate;
        
        if (!reportStartDate || !reportEndDate) {
            const now = new Date();
            switch (filterBy) {
                case '1day':
                    reportStartDate = new Date(now.setDate(now.getDate() - 1)).toLocaleDateString();
                    reportEndDate = new Date().toLocaleDateString();
                    break;
                case 'week':
                    reportStartDate = new Date(now.setDate(now.getDate() - 7)).toLocaleDateString();
                    reportEndDate = new Date().toLocaleDateString();
                    break;
                case 'month':
                    reportStartDate = new Date(now.setMonth(now.getMonth() - 1)).toLocaleDateString();
                    reportEndDate = new Date().toLocaleDateString();
                    break;
                case 'year':
                    reportStartDate = new Date(now.setFullYear(now.getFullYear() - 1)).toLocaleDateString();
                    reportEndDate = new Date().toLocaleDateString();
                    break;
                default:
                    reportStartDate = 'Start';
                    reportEndDate = 'End';
            }
        }

        //create PDF
        const doc = new PDFDocument({
            size: 'A4',
            margin: 40
        });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=SalesReport.pdf');
        doc.pipe(res);

        // Add Title
        doc.fontSize(16).text(`Sales Report (${reportStartDate || 'Start'} to ${reportEndDate || 'End'})`, { align: 'center' });
        doc.moveDown(2);

        // Add Table Headers
        const columnPositions = {
            customerName: 40,
            orderDate: 130,
            productName: 180,
            price: 280,
            quantity: 315,
            totalAmount: 360,
            totalDiscount: 400,
            status: 460,
            paymentStatus: 510
        };

        // Headers
        doc.fontSize(11);
        doc.text('Customer Name', columnPositions.customerName, 80);
        doc.text('Date', columnPositions.orderDate, 80);
        doc.text('Product Name', columnPositions.productName, 80);
        doc.text('Price', columnPositions.price, 80);
        doc.text('Quantity', columnPositions.quantity, 80);
        doc.text('Total', columnPositions.totalAmount, 80);
        doc.text('Discount', columnPositions.totalDiscount, 80);
        doc.text('Status', columnPositions.status, 80);
        doc.text('Payment', columnPositions.paymentStatus, 80);
        doc.moveDown();

        let no=1;
        orders.forEach(order => {
            const currentY = doc.y; 
            doc.fontSize(9).text(no+"."+order.userId?.name, columnPositions.customerName, currentY);
            doc.text(new Date(order.orderDate).toLocaleDateString(), columnPositions.orderDate, currentY);
            //first product 
            no++;
            if (order.products.length > 0) {
                const firstProduct = order.products[0];
                doc.text(firstProduct.productId?.productName, columnPositions.productName, currentY);
                doc.text(firstProduct.productId?.price.toFixed(2), columnPositions.price, currentY);
                doc.text(firstProduct.quantity, columnPositions.quantity, currentY);
                doc.text((firstProduct.productId.price * firstProduct.quantity).toFixed(2), columnPositions.totalAmount, currentY);
                doc.text(firstProduct.offerAmount.toFixed(2), columnPositions.totalDiscount, currentY);
                doc.text(firstProduct.status, columnPositions.status, currentY);
                doc.text(order.paymentStatus, columnPositions.paymentStatus, currentY);
            }
            //remaining product
            for (let i = 1; i < order.products.length; i++) {
                const product = order.products[i];
                doc.moveDown(0.5);
                const productY = doc.y;
                doc.fontSize(9);
                doc.text(product.productId?.productName, columnPositions.productName, productY);
                doc.text(product.productId?.price, columnPositions.price, productY);
                doc.text(product.quantity, columnPositions.quantity, productY);
                doc.text(product.productId.price * product.quantity, columnPositions.totalAmount, productY);
                doc.text(product.offerAmount, columnPositions.totalDiscount, productY);
                doc.text(product.status, columnPositions.status, productY);
                doc.text(order.paymentStatus, columnPositions.paymentStatus, productY);
            }

            // Add coupon and order total (once per order)
            doc.moveDown(0.5);
            doc.fontSize(9).text(`Coupon Applied: ${order.couponDiscount.toFixed(2)}`, columnPositions.totalAmount, doc.y);
            doc.moveDown(0.5);
            doc.fontSize(9).text(`Order Total: ${order.totalAmount.toFixed(2)}`, columnPositions.totalAmount, doc.y);
            doc.moveDown(0.5);
        });

        
        
        // Total calculations 
        doc.moveDown(1);
        doc.fontSize(12).text(`Total Orders: ${orders.length}`, 230);
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Total Discount: ${orders.reduce((acc, order) => acc + order.totalDiscount, 0).toFixed(2)}`,230);
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Total Amount: ${orders.reduce((acc, order) => acc + order.totalAmount, 0).toFixed(2)}`,230);
        doc.end();
    } catch (error) {
        console.error('Error generating PDF report:', error);
        res.status(500).send('Error generating PDF report');
    }
};


module.exports = {
    getDashboard,
    salesList,
    downloadExcelReport,
    downloadPDFReport
}