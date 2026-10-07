export default function handler(_req, res) {
  res.status(410).json({
    error: "Order notifications are now sent by the secure checkout service.",
  });
}
