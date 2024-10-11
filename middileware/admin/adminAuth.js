const adminAuth = (req, res, next) => {
    if (req.session.admin && req.session.admin.id) {
        return next(); // Proceed if the admin is authenticated
    }
    res.redirect('/admin');
}
module.exports = adminAuth;