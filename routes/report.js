var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('report', { title: 'Demand Response Report'});  
});

module.exports = router;