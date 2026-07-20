import jwt from "jsonwebtoken";

export const genAccessToken = (userId)=> {
    const secret = process.env.JWT_ACCESS_SECRET;
    const expiry = process.env.JWT_ACCESS_EXPIRATION;
    return genToken(userId, secret, expiry);
}

export const genRefreshToken = (userId)=> {
    const secret = process.env.JWT_REFRESH_SECRET;
    const expiry = process.env.JWT_REFRESH_EXPIRATION;
    return genToken(userId, secret, expiry);
}

function genToken(userId, secret, expiry) {
    const payload = { id: userId }

    const token = jwt.sign(
        payload,
        secret,
        {expiresIn: expiry}
    );

    return token;
}