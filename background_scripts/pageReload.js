// noinspection JSUnresolvedReference,JSDeprecatedSymbols,JSCheckFunctionSignatures
browser.runtime.onMessage.addListener((request) => {
    const reload = request.reload;

    if (reload) {
        console.log(reload);
        // noinspection JSUnresolvedVariable
        browser.tabs.reload({ bypassCache: true });
    }
});
