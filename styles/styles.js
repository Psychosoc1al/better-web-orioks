/**
 * Centers the modal dialog vertically in the viewport.
 *
 * @param {HTMLElement} modalDialog - the modal dialog element
 */
const centerModalVertically = function (modalDialog) {
    const viewportHeight = window.innerHeight;
    const modalHeight = modalDialog.getBoundingClientRect().height;

    modalDialog.style.marginTop = `${Math.max((viewportHeight - modalHeight) / 2, 0)}px`;
};

/**
 * Observes the parent element of the modal dialog and centers it vertically.
 *
 * @param {HTMLElement} modalDialog - the modal dialog element
 */
const observeModalParent = function (modalDialog) {
    const parentElement = modalDialog.parentElement;

    const observer = new MutationObserver(() => {
        if (parentElement.display !== "none")
            centerModalVertically(modalDialog);
    });

    observer.observe(parentElement, {
        attributes: true,
        attributeFilter: ["style"],
    });
};

/**
 * Starts observing the first appearance of the modal dialog.
 */
const startFirstAppearObserver = function () {
    const firstAppearObserver = new MutationObserver((mutations) =>
        mutations.forEach((mutation) =>
            mutation.addedNodes.forEach((node) => {
                if (
                    node.nodeType === Node.ELEMENT_NODE &&
                    node.matches("div.modal-dialog")
                ) {
                    observeModalParent(node);
                    window.addEventListener("resize", () =>
                        centerModalVertically(node),
                    );

                    firstAppearObserver.disconnect();
                }
            }),
        ),
    );

    firstAppearObserver.observe(document, { childList: true, subtree: true });
};

startFirstAppearObserver();
