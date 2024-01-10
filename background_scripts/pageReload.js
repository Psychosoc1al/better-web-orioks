const studentPattern = "https://orioks.miet.ru/student/student";

// noinspection JSUnresolvedReference,JSDeprecatedSymbols,JSCheckFunctionSignatures
browser.runtime.onMessage.addListener((request) => {
    const reload = request.reload;

    if (reload) {
        // noinspection JSUnresolvedVariable
        browser.tabs.reload({ bypassCache: true });
    }
});

let reload = true;
let oldUrl;
const forceReload = function (tabId, changeInfo) {
    if (changeInfo.status === "complete") {
        // noinspection JSUnresolvedReference
        browser.tabs
            .query({ active: true, lastFocusedWindow: true })
            .then((tabs) => (oldUrl = tabs[0].url));
    }

    let newUrl = changeInfo.url;
    if (
        // checks if it is a transition to the student page
        (newUrl?.includes(studentPattern) &&
            oldUrl &&
            !oldUrl.includes(studentPattern)) ||
        // checks if it is a reload of the student page
        (newUrl?.includes(studentPattern) && oldUrl?.includes(studentPattern))
    )
        if (reload && changeInfo.status === "loading") {
            reload = false;

            // noinspection JSUnresolvedVariable
            browser.tabs.reload({ bypassCache: true });
            setTimeout(() => (reload = true), 1500);
        }
};

// noinspection JSUnresolvedReference,JSDeprecatedSymbols,JSCheckFunctionSignatures
browser.tabs.onUpdated.addListener(forceReload);
