const publicPages = ['home', 'services', 'doctors', 'about', 'contact', 'faq', 'privacy', 'book', 'doctor-portal'];

export const isPublicPage = (route: string) => publicPages.includes(route);
