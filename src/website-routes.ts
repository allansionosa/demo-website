const publicPages = ['home', 'services', 'doctors', 'about', 'contact', 'faq', 'privacy', 'book'];

export const isPublicPage = (route: string) => publicPages.includes(route);
