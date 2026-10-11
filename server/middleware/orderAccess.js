const Order = require("../models/Order");
const { isValidAccessToken, compareAccessTokens } = require("../utils/orderAccess");
const { sendApiError } = require("../utils/apiError");

const invalidLink = (res) => res.status(404).json({
  message: "This payment link is invalid or outdated. Please contact GrandPrint",
});

const requireOrderAccess = async (req, res, next) => {
  const token = req.get("X-Order-Access-Token");
  if (!isValidAccessToken(token)) return invalidLink(res);

  try {
    const order = await Order.findOne({ orderId: req.params.orderId }).select("+accessToken");
    if (!order || !compareAccessTokens(token, order.accessToken)) {
      return invalidLink(res);
    }
    req.order = order;
    next();
  } catch (err) {
    sendApiError(res, err, "Server Error", "requireOrderAccess");
  }
};

module.exports = requireOrderAccess;
