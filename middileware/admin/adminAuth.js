const adminAuth = (req, res, next) => {
    if (req.session.admin && req.session.admin.id) {
        return next(); 
    }
    res.redirect('/admin');
}
module.exports = adminAuth;