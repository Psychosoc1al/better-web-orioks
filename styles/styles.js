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
 * Loads the full news into the modal dialog.
 *
 * @param {HTMLElement} newsModal - the modal dialog element
 */
const loadFullNews = function (newsModal) {
    const title = newsModal.querySelector("h2.modal-title");
    const dest = newsModal.querySelector("div.modal-body");
    const newsLink =
        origin + newsModal.querySelector(".modal-title a").getAttribute("href");

    dest.classList.remove("fade", "in");
    dest.classList.add("fade");

    while (dest.firstChild) dest.removeChild(dest.firstChild);
    centerModalVertically(newsModal);

    const loadPlaceholder = document.createElement("h2");
    loadPlaceholder.classList.add("text-center");
    loadPlaceholder.innerHTML = "Загрузка...";
    dest.appendChild(loadPlaceholder);

    fetch(newsLink)
        .then((resp) => resp.text())
        .then((text) => {
            loadPlaceholder.classList.add("fade");

            return new DOMParser().parseFromString(text, "text/html");
        })
        .then((newsPage) => {
            const metadata = Array.from(
                newsPage.documentElement.querySelectorAll("h4"),
            ).slice(0, 2);
            const children = newsPage.documentElement.querySelector(
                "div.container div.margin-top",
            ).children;

            title.after(...metadata);

            dest.removeChild(loadPlaceholder);
            for (const child of children)
                dest.appendChild(child.cloneNode(true));
        })
        .then(() => {
            dest.classList.add("in");

            centerModalVertically(newsModal);
        });
};

/**
 * Observes the parent element of the modal dialog and centers it vertically.
 *
 * @param {HTMLElement} modalDialog - the modal dialog element
 */
const observeModalParent = function (modalDialog) {
    const parentElement = modalDialog.parentElement;

    const observer = new MutationObserver(() => {
        const modalState = parentElement.style.display;

        if (modalState !== "none") {
            centerModalVertically(modalDialog);

            if (
                parentElement.id === "postViewModal" &&
                this.previousModalState !== modalState
            )
                loadFullNews(modalDialog);
        }

        this.previousModalState = modalState;
    });

    observer.observe(parentElement, {
        attributeFilter: ["style"],
    });
};

/**
 * Fixes the overflow of the practice table.
 *
 * @param {HTMLElement} table - the practice table element
 */
const fixPracticeOverflow = function (table) {
    let wrapperDiv = document.createElement("div");
    wrapperDiv.style.overflowX = "auto";
    table.parentNode.insertBefore(wrapperDiv, table);
    wrapperDiv.appendChild(table);
};

/**
 * Starts observing the first appearance of the modal dialog.
 */
const startFirstAppearObservers = function () {
    const modalAppearObserver = new MutationObserver((mutations) =>
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

                    modalAppearObserver.disconnect();
                    practiceTableObserver.disconnect();
                }
            }),
        ),
    );

    modalAppearObserver.observe(document, { childList: true, subtree: true });

    const practiceTableObserver = new MutationObserver((mutations) =>
        mutations.forEach((mutation) =>
            mutation.addedNodes.forEach((node) => {
                if (
                    node.nodeType === Node.ELEMENT_NODE &&
                    node.matches("table.table.table-bordered")
                ) {
                    fixPracticeOverflow(node);

                    modalAppearObserver.disconnect();
                    practiceTableObserver.disconnect();
                }
            }),
        ),
    );

    practiceTableObserver.observe(document, { childList: true, subtree: true });
};

startFirstAppearObservers();
