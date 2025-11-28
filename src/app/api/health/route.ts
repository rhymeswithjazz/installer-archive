// health check route

import { NextRequest, NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({ status: 'healthy', timestamp: new Date().toISOString() });
}