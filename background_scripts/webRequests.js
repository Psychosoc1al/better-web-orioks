let group;

/**
 * Sends a request to the schedule server
 *
 * @param {string} url - The URL to send the request to
 * @param {string} method - The request method
 * @return { Promise<string>} A promise that resolves with the response text
 */
const sendRequest = function (url, method) {
    return fetch(url, {
        method: method,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `group=${group}`,
        credentials: "include",
    }).then((response) => response.text());
};

const handleMessage = function (request, sender, sendResponse) {
    group = request.group;
    if (!group) return false;

    sendRequest("https://miet.ru/schedule/data", "POST")
        .then((responseText) => {
            const cookie = RegExp(/wl=(.*);path=\//).exec(responseText);
            if (cookie) {
                // noinspection JSUnresolvedReference
                browser.cookies.set({
                    url: "https://miet.ru/schedule/data",
                    name: "wl",
                    value: cookie[1],
                });
                return sendRequest(
                    "https://miet.ru/schedule/data",
                    "POST",
                ).then((responseText) => JSON.parse(responseText));
            }

            return JSON.parse(responseText);
        })
        .then((data) => sendResponse({ response: data }));

    return true;
};

// noinspection JSUnresolvedReference,JSDeprecatedSymbols,JSCheckFunctionSignatures
browser.runtime.onMessage.addListener(handleMessage);
