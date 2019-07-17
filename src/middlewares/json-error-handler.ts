
import {HttpError} from "http-errors";
import {Middleware} from "middy";


export const jsonErrorHandler: Middleware<undefined, any, any> = () => {

    return ({
        onError: (handler, next) => {
            if (handler.error instanceof HttpError) {
                // as per JSON spec http://jsonapi.org/examples/#error-objects-basics
                handler.error.message = JSON.stringify({
                    errors: [{
                        status: handler.error.statusCode,
                        message: handler.error.message,
                        detail: handler.error.details,
                    }],
                });

                return next()
            }

            return next(handler.error)
        },

    });

};

