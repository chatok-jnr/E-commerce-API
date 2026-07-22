import crypto from "crypto";

export const resolveCartOwner = (req, res, next) => {
    try{

        // Case 1: logged-in user (protect may or may not have already run —
        // check for req.user set by an earlier optional-auth check)
        if (req.user) {
            req.cartOwner = { userId: req.user.id };
            return next();
        }

        // Case 2: guest — look for an existing session cookie
        let sessionId = req.cookies.cart_session;

        if (!sessionId) {
            // First time this browser is touching the cart — issue one
            sessionId = crypto.randomUUID();
            res.cookie("cart_session", sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: "lax",
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
            });
        }

        req.cartOwner = {sessionId};
        next();

    } catch(e) {
        console.error(e);

        return res.status(500).json({
            status:'failed',
            message:process.env.NODE_ENV === 'production'
                ?"Internal server error"
                : e.message
        });
    }
}