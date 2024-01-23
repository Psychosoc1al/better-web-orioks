let metabrowser;
try {
    // noinspection JSUnresolvedReference
    metabrowser = browser;
} catch (e) {
    // noinspection JSUnresolvedReference
    metabrowser = chrome;
}
const hourLength = 1000 * 60 * 60;

// noinspection JSUnresolvedReference
/**
 * Retrieves the value associated with the given key
 *
 * @param {string} key - The key to retrieve the value for
 * @return {Promise<Object>} - The value associated with the given key
 */
const loadValueByKey = (key) =>
    metabrowser.storage.local.get(key).then((res) => res[key]);

/**
 * Updates the grade fields based on the newest data
 */
const updateGrades = function () {
    const source = document.querySelector("#forang");
    const jsonData = JSON.parse(source.textContent);
    const disciplines = jsonData["dises"];

    for (const element of disciplines) {
        const controlPoints = element["segments"][0]["allKms"];
        const grade = element["grade"];
        const controlForm = element["formControl"]["name"];
        const maxPossibleSum = element["mvb"];
        let sum = 0;

        for (const element of controlPoints) {
            const balls = element["balls"][0];

            if (balls && balls["ball"] > 0) sum += balls["ball"];
        }

        grade["b"] = numberToFixedString(sum); // current ball
        grade["p"] = numberToFixedString((sum / maxPossibleSum) * 100); // current percentage
        // [maximal grade ("из ..."), class attribute for coloring]
        [grade["w"], grade["o"]] = getGradeNameAndType(
            sum / maxPossibleSum,
            controlForm,
        );
    }

    source.textContent = JSON.stringify(jsonData);
};

/**
 * Adjusts a number to be integer if possible and rounded to at most 2 decimal places if not
 *
 * @param {number} number - The number to be adjusted
 * @return {string} The adjusted number as a string
 */
const numberToFixedString = function (number) {
    if (!number) return "0";

    let stringedNumber = number.toFixed(2);

    while (stringedNumber.endsWith("0"))
        stringedNumber = stringedNumber.slice(0, -1);

    if (stringedNumber.endsWith("."))
        stringedNumber = stringedNumber.slice(0, -1);

    return stringedNumber;
};

/**
 * Gets the grade string representation and its type (projection to five-ball system)
 *
 * @param {number} gradeRatio - the grade ratio (grade / maxGrade)
 * @param {string} controlForm - the control type to check if it is a credit
 *
 * @return {[string, number]} The new grade class as a string
 */
const getGradeNameAndType = function (gradeRatio, controlForm) {
    const isCredit = controlForm === "Зачёт";

    if (gradeRatio < 0.5) {
        if (gradeRatio < 0.2) return ["Не зачтено", 1];
        return ["Не зачтено", 2];
    } else if (gradeRatio < 0.7)
        return isCredit ? ["Зачтено", 5] : ["Удовлетворительно", 3];
    else if (gradeRatio < 0.86)
        return isCredit ? ["Зачтено", 5] : ["Хорошо", 4];
    else return isCredit ? ["Зачтено", 5] : ["Отлично", 5];
};

/**
 * Sets the schedule based on the closest lessons
 */
const setSchedule = function () {
    const group = document
        .querySelector('select[name="student_id"] option')
        .innerText.split(" ")[0];

    const currentWeekElement = document.querySelector(".small");
    if (!currentWeekElement) {
        setExamsSchedule(group);
        return;
    }

    let stringCurrentWeek = currentWeekElement.innerText.split("\n")[1];
    if (!stringCurrentWeek)
        stringCurrentWeek = currentWeekElement.innerText
            .split(" ")
            .slice(3)
            .join(" ");

    loadValueByKey(group).then((fullSchedule) => {
        if (Object.keys(fullSchedule).length === 0) {
            setExamsSchedule(group);
            return;
        }

        const now = new Date();
        const source = document.querySelector("#forang");
        const jsonData = JSON.parse(source.textContent);
        const schedule = [];
        let closestDays = fullSchedule[stringCurrentWeek][now.getDay()];
        let baseOffset = 0;

        if (closestDays[0].dateOffset === 0) {
            closestDays[0].lessons = closestDays[0].lessons.filter(
                (lesson) =>
                    lesson.endTime >
                    now.toLocaleTimeString("ru", {
                        hour: "2-digit",
                        minute: "2-digit",
                    }),
            );

            if (!closestDays[0].lessons.length) {
                baseOffset++;
                closestDays =
                    fullSchedule[stringCurrentWeek][(now.getDay() + 1) % 7];
            }
        }

        for (let i = 0; i < closestDays.length; i++) {
            const lessonDate = new Date();
            lessonDate.setDate(
                lessonDate.getDate() + baseOffset + closestDays[i].dateOffset,
            );

            schedule[i] = [];
            schedule[i][0] = lessonDate.toLocaleDateString("ru", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
            });
            schedule[i][1] = [];

            for (const lesson of closestDays[i].lessons) {
                let lessonName, lessonType;
                let lessonTypeMatch = lesson.name.match(/\[(.*)]/);

                if (lessonTypeMatch) {
                    lessonName = lesson.name.match(/(.*) \[?/)[1];
                    lessonType = lessonTypeMatch[1];
                } else {
                    lessonName = lesson.name;
                    lessonType = "";
                }

                schedule[i][1].push({
                    name: `${lessonName}
                            ► ${lesson.teacher}\n`,
                    type: lessonType,
                    location: lesson.room,
                    time:
                        (lesson.startTime === "12:00"
                            ? "12:00/30"
                            : lesson.startTime) +
                        "\n ~ \n" +
                        (lesson.endTime === "13:20"
                            ? "13:20/50"
                            : lesson.endTime),
                });
            }
        }

        jsonData["schedule"] = schedule;
        source.textContent = JSON.stringify(jsonData);
    });
};

/**
 * Gets the exams schedule if it is session time
 *
 * @param {string} group - The current group
 */
const setExamsSchedule = function (group) {
    const source = document.querySelector("#forang");
    const jsonData = JSON.parse(source.textContent);
    const schedule = [];
    const timeConvertOptions = {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        timeZone: "Europe/Moscow",
    };
    let currentDateTime = Date.now();

    loadValueByKey(group + "-exams").then((examsSchedule) => {
        for (const day of examsSchedule) {
            const dayDateTime = new Date(day[1]);

            if (currentDateTime - hourLength < dayDateTime) {
                // noinspection JSUnresolvedReference
                day.unshift(
                    dayDateTime.toLocaleDateString("ru", timeConvertOptions) +
                        getTimeLeftString(currentDateTime, dayDateTime),
                );

                schedule.push(day);
            }
        }

        jsonData["schedule"] = schedule;
        source.textContent = JSON.stringify(jsonData);
    });
};

/**
 * Counts the time until the event and returns the time left string or an empty string
 * if it's less than an hour left
 *
 * @param {number} now - The current timestamp
 * @param {Date|number} event - The event {@link Date} object or timestamp
 * @return {string} The time left string or an empty string
 */
const getTimeLeftString = function (now, event) {
    let timeLeft = event - now;

    if (timeLeft > hourLength) {
        const days = Math.floor(timeLeft / (hourLength * 24));
        const hours = Math.floor(
            (timeLeft - days * hourLength * 24) / hourLength,
        );

        return ` (осталось: ${days ? days + "д. " : ""}${hours}ч.)`;
    }

    return "";
};

/**
 * Waits for the element to appear to start the script
 *
 * @param {Array<string>} selectors - The CSS selector of the element
 * @return {Promise<void>} A promise to be resolved when the element is found
 */
const waitForElement = function (selectors) {
    return new Promise((resolve) => {
        if (selectors.every((selector) => document.querySelector(selector)))
            return resolve();

        const observer = new MutationObserver(() => {
            if (
                selectors.every((selector) => document.querySelector(selector))
            ) {
                observer.disconnect();
                resolve();
            }
        });

        observer.observe(document, {
            childList: true,
            subtree: true,
        });
    });
};

// noinspection JSUnresolvedVariable
/**
 * Checks if there is a new schedule and updates the storaged one if needed
 */
const checkUpdates = () =>
    metabrowser.runtime.sendMessage({ action: "checkUpdates" });

/**
 * Executes the necessary actions when the page is opened.
 */
const onPageOpen = function () {
    waitForElement(['select[name="student_id"] option', "#forang"]).then(() => {
        updateGrades();
        setSchedule();
        checkUpdates();
    });
};

onPageOpen();
