const adminAuthed = (req, res, next) => {
    if (req.session.admin && req.session.admin.id) {
        return res.redirect('/admin/home');
    }
    next();
}
module.exports = adminAuthed;