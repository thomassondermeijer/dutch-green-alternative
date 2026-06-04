import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { i18n, type Locale } from '@/i18n/config';
import { createServerClient } from '@supabase/ssr';

function getLocaleFromHeaders(request: NextRequest): Locale {
    // 1. Check cookie for saved preference
    const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
    if (cookieLocale && i18n.locales.includes(cookieLocale as Locale)) {
        return cookieLocale as Locale;
    }

    // 2. Check Accept-Language header
    const acceptLanguage = request.headers.get('accept-language');
    if (acceptLanguage) {
        const languages = acceptLanguage
            .split(',')
            .map((lang) => {
                const [code, q] = lang.trim().split(';q=');
                return { code: code.split('-')[0].toLowerCase(), quality: q ? parseFloat(q) : 1 };
            })
            .sort((a, b) => b.quality - a.quality);

        for (const { code } of languages) {
            if (i18n.locales.includes(code as Locale)) {
                return code as Locale;
            }
        }
    }

    // 3. Default
    return i18n.defaultLocale;
}

function getLocaleFromPathname(pathname: string): Locale | null {
    const segments = pathname.split('/');
    const potentialLocale = segments[1];
    if (i18n.locales.includes(potentialLocale as Locale)) {
        return potentialLocale as Locale;
    }
    return null;
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // --- Admin route protection ---
    if (pathname.startsWith('/admin')) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.redirect(new URL('/de/account/login', request.url));
        }

        // Create Supabase client to check auth
        let response = NextResponse.next({ request });
        const supabase = createServerClient(supabaseUrl, supabaseKey, {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        });

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            // Not logged in → redirect to login
            return NextResponse.redirect(new URL('/de/account/login?redirect=/admin', request.url));
        }

        // Check if user is admin
        const { data: adminUser } = await supabase
            .from('admin_users')
            .select('id')
            .eq('email', user.email)
            .single();

        if (!adminUser) {
            // Logged in but not admin → redirect to homepage
            return NextResponse.redirect(new URL('/de', request.url));
        }

        return response;
    }

    // Skip locale handling for static files, API routes, and auth callbacks
    // (the /auth/callback route handler is locale-agnostic and must not be
    // locale-prefixed, or the magic-link redirect 404s)
    const isStaticOrApi =
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/auth') ||
        pathname.includes('.') ||
        pathname.startsWith('/favicon');

    if (!isStaticOrApi) {
        const pathnameLocale = getLocaleFromPathname(pathname);

        // If no locale in pathname, redirect to detected locale
        if (!pathnameLocale) {
            const detectedLocale = getLocaleFromHeaders(request);
            const newUrl = new URL(`/${detectedLocale}${pathname}`, request.url);
            newUrl.search = request.nextUrl.search;

            const response = NextResponse.redirect(newUrl);
            response.cookies.set('NEXT_LOCALE', detectedLocale, {
                maxAge: 365 * 24 * 60 * 60, // 1 year
                path: '/',
            });
            return response;
        }
    }

    // Continue with Supabase session refresh
    return await updateSession(request);
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder files
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
