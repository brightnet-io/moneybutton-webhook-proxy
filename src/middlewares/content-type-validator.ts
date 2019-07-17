import * as contentTypeLib from "content-type";
import * as httpErrors from "http-errors";
import {Middleware} from "middy";


export const contentTypeValidator: Middleware<ContentTypeValidatorConfig, any, any> = (config: ContentTypeValidatorConfig) => {

   config = config !== undefined ? config : {
        requireContentType: 'application/json',
    };

    const errorMessage = `Endpoint requires Content-Type header value ${config.requireContentType}`;

    return ({
        before: (handler, next) => {
            const {headers} = handler.event;
            if (!headers || (!headers['Content-Type'] && !headers['content-type']) ) {
                throw new httpErrors.BadRequest(errorMessage)
            }
            const contentType = headers['Content-Type'] || headers['content-type'];
            if (contentType) {
                const {type} = contentTypeLib.parse(contentType);
                if (type !== config.requireContentType) {
                    throw new httpErrors.BadRequest(errorMessage)
                }
            }
            next();
        },

    });


};

// tslint:disable-next-line:interface-over-type-literal
type ContentTypeValidatorConfig = {
    requireContentType: string;
}