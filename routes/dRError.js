var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('dRError', { title: 'Demand Response Details Error' });
});

module.exports = router;