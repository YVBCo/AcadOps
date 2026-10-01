declare module 'swagger-ui-express' {
    import { RequestHandler } from 'express';

    interface SwaggerUiOptions {
        customCss?: string;
        customCssUrl?: string;
        customJs?: string;
        customfavIcon?: string;
        customSiteTitle?: string;
        explorer?: boolean;
        swaggerOptions?: Record<string, unknown>;
        isExplorer?: boolean;
    }

    function serve(): RequestHandler[];
    function setup(
        swaggerDoc: Record<string, unknown>,
        opts?: SwaggerUiOptions,
        options?: Record<string, unknown>,
        customCss?: string,
        customfavIcon?: string,
        swaggerUrl?: string,
        customSiteTitle?: string
    ): RequestHandler;

    const swaggerUi: {
        serve: typeof serve;
        setup: typeof setup;
    };

    export = swaggerUi;
}
