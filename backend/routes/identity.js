const {Router} = require("express");
const api = require("../../api/index");
const {IdentityService} = require("../../api");
 
const router = Router();

router.get("/", (req, res) => {
    res.json({success: true, data: req.session.identity});
});
 
router.get('/:identityId', (req, res) => {
    api.getFullIdentity(req.params.identityId).then(identity => {
        res.json({success: true, data: identity});
    }).catch(err => {
        if (err === "Identity was not found!") {
            res.json({success: true, data: null});
        } else {
            res.json({success: false, error: err});
        }
    });
});
 
module.exports = router;