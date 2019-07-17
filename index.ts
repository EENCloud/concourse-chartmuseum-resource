import { Headers } from "node-fetch";

export async function retrieveRequestFromStdin<T extends any>(): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        let inputRaw = "";
        process.stdin.on("data", (chunk) => inputRaw += chunk);
        process.stdin.on("end", async () => {
            try {
                const json = JSON.parse(inputRaw) as T;
                if (!json.source.server_url.endsWith("/")) {
                    // Forgive input errors and append missing slash if the user did not honor the docs.
                    json.source.server_url = `${json.source.server_url}/`;
                }
                resolve(json);
            } catch (e) {
                reject(e);
            }
        });
    });
}

export function createFetchHeaders<R extends ICheckRequest>(request: R): Headers {
    const headers = new Headers();
    if (request.source.basic_auth_username && request.source.basic_auth_password) {
        const basicAuthUsername = request.source.basic_auth_username;
        const basicAuthPassword = request.source.basic_auth_password;
        headers.append(
            "Authorization", `Basic ${new Buffer(basicAuthUsername + ":" + basicAuthPassword).toString("base64")}`);
    }
    return headers;
}

interface IRequest {
    source: {
        server_url: string;
        chart_name: string;
        project: string;
        version_range?: string;
        basic_auth_username?: string;
        basic_auth_password?: string;
    };
}

export interface ICheckRequest extends IRequest {
    version?: {
        version: string;
        digest: string;
    };
}

export type CheckResponse = Array<{
    version: string;
    digest: string;
}>;

export interface IInRequest extends ICheckRequest {
    version: {
        version: string;
        digest: string;
    };
    params: {
        target_basename?: string,
    };
}

export interface IResponse {
    version: {
        version: string,
        digest: string,
    };
    metadata: Array<{
        name: string;
        value: string;
    }>;
}

export interface IOutRequest extends IRequest {
    params: {
        chart: string;
        sign?: boolean;
        key_data?: string;
        key_file?: string;
        key_passphrase?: string;
        app_version?: string;
        version?: string;
        version_file?: string;
        force?: boolean;
    };
}
