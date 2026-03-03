import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_KEY);
const ALG = 'HS256';

export async function signClientToken(payload: { id: string; role: 'client' }) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: ALG })
        .setIssuedAt()
        .setExpirationTime('7d') // Compromiso MVP: 7 días. En el futuro, usar Refresh Tokens.
        .sign(JWT_SECRET);
}

export async function verifyClientToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload;
    } catch (error) {
        return null;
    }
}