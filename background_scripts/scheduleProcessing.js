let metabrowser;
try {
    // noinspection JSUnresolvedReference
    metabrowser = browser;
} catch (e) {
    // noinspection JSUnresolvedReference
    metabrowser = chrome;
}
const hourLength = 1000 * 60 * 60;
const updateCheckPeriod = hourLength * 6;
let group;
let documentHTML;

// noinspection JSUnresolvedReference
/**
 * Save a key-value pair to the storage
 *
 * @param {string} key - The key to save
 * @param {Object} value - The value to save
 */
const saveKeyValue = (key, value) =>
    metabrowser.storage.local.set({ [key]: value });

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
 * Sends a request to the schedule server
 *
 * @param {string} url - The URL to send the request to
 * @param {string} method - The request method
 * @return {Promise<string>} A promise that resolves with the response text
 */
const sendRequest = function (url, method) {
    return fetch(url, {
        method: method,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: method === "POST" ? `group=${group}` : undefined,
        credentials: "include",
    }).then((response) => response.text());
};

/**
 * Gets the group by sending a request and saves it with the original HTML
 *
 * @return {Promise<boolean>} A promise that resolves with true if the group was successfully set
 */
const setGroupAndHTML = function () {
    if (group) return Promise.resolve(true);

    return sendRequest("https://orioks.miet.ru/student/student", "GET").then(
        (responseText) => {
            documentHTML = responseText;

            group = new RegExp(/selected>([А-Я]+-\d\d[А-Я]*) \(2\d{3}/).exec(
                responseText,
            )[1];

            return true;
        },
    );
};

/**
 * Counts the full schedule cycle and saves it
 *
 * @param parsedSchedule - The parsed (processed) schedule
 */
const countSchedule = function (parsedSchedule) {
    const fullSchedule = {
        "1 числитель": [],
        "1 знаменатель": [],
        "2 числитель": [],
        "2 знаменатель": [],
    };

    for (let [weekNum, weekString] of Object.keys(fullSchedule).entries())
        for (let dayNum = 1; dayNum < 7; dayNum++)
            fullSchedule[weekString].push(
                collapseDuplicatedLessons(
                    getClosestLessons(parsedSchedule, weekNum, dayNum),
                ),
            );

    const weekStrings = Object.keys(fullSchedule);
    for (let [weekNum, weekString] of weekStrings.entries()) {
        const sundaySchedule = structuredClone(
            fullSchedule[weekStrings[(weekNum + 1) % 4]][0],
        );
        sundaySchedule.forEach((day) => (day.dateOffset += 1));
        fullSchedule[weekString].unshift(sundaySchedule);
    }

    saveKeyValue(group, fullSchedule);
};

/**
 * Sets the schedule based on the current time and day or on finds the closest lessons
 *
 * @param {Object} schedule - The whole schedule object
 * @param {number} searchWeekNumber - The week number to start search
 * @param {number} startDay - The day number to start search
 * @param {number} daysOffset - The offset in days from the current day to start search
 * @param {boolean} weekChanged - Whether the week has changed while searching the closest day
 * @return {Object[]} The closest two days lessons list
 */
const getClosestLessons = function (
    schedule,
    searchWeekNumber,
    startDay,
    daysOffset = 0,
    weekChanged = false,
) {
    let currentDayNumber = startDay + daysOffset;
    let searchDayNumber = currentDayNumber - 1;
    let closestLessons = [];
    let nextOffset = daysOffset;

    if (currentDayNumber === 0) {
        searchWeekNumber = ++searchWeekNumber % 4;
        searchDayNumber = 0;
        nextOffset++;
        weekChanged = true;
    } else if (weekChanged) searchWeekNumber = ++searchWeekNumber % 4;

    while (!closestLessons.length) {
        searchDayNumber = ++searchDayNumber % 7;
        nextOffset++;
        if (searchDayNumber === 0) {
            searchWeekNumber = ++searchWeekNumber % 4;
            searchDayNumber = 1;
            nextOffset++;
            weekChanged = true;
        }

        closestLessons = schedule.filter(
            (lesson) =>
                lesson.dayNumber === searchDayNumber &&
                lesson.weekNumber === searchWeekNumber &&
                !lesson.teacher.includes("УВЦ"),
        );
    }

    closestLessons = structuredClone(closestLessons);

    closestLessons.sort((a, b) => {
        return a.lessonNumber > b.lessonNumber ? 1 : -1;
    });

    if (daysOffset === 0)
        return [
            {
                dateOffset: nextOffset - 1,
                lessons: closestLessons,
            },
        ].concat(
            getClosestLessons(
                schedule,
                searchWeekNumber,
                startDay,
                nextOffset,
                weekChanged,
            ),
        );

    return [
        {
            dateOffset: nextOffset - 1,
            lessons: closestLessons,
        },
    ];
};

/**
 * Collapses multiplied lessons with the same name into one
 *
 * @param closestDays - The list of closest days with lessons (see {@link getClosestLessons()})
 * @return {Object[]} The list of closest days with refactored lessons
 */
const collapseDuplicatedLessons = function (closestDays) {
    for (const day of closestDays) {
        const collapsedLessons = [];
        let currentLesson;
        let currentLessonNumber = 0;
        let lessonCount = 1;

        for (let i = 0; i < day.lessons.length; i++) {
            if (day.lessons[i].name === day.lessons[i + 1]?.name) {
                lessonCount++;
                continue;
            }

            if (lessonCount > 1) {
                currentLesson = day.lessons[currentLessonNumber];
                let name = currentLesson.name;
                let amountPart = `(${lessonCount} пар${
                    lessonCount < 5 ? "ы" : ""
                })`;

                if (name.indexOf("[") !== -1)
                    name = name.replace("[", amountPart + " [");
                else name += amountPart;

                currentLesson.name = name;
                currentLesson.endTime = day.lessons[i].endTime;
                collapsedLessons.push(currentLesson);
            } else collapsedLessons.push(day.lessons[i]);

            currentLessonNumber += lessonCount;
            lessonCount = 1;
        }

        day.lessons = collapsedLessons;
    }

    return closestDays;
};

/**
 * Parses the schedule data received from the server
 *
 * @return {Promise<Array<Object>>} An array of parsed and formatted schedule elements
 */
const parseSchedule = function () {
    return loadValueByKey(`${group}-orig`).then((schedule) => {
        const parsedSchedule = [];

        for (const scheduleElement of schedule["Data"]) {
            const parsedElement = {};

            parsedElement["name"] = scheduleElement["Class"]["Name"];
            parsedElement["teacher"] = scheduleElement["Class"]["TeacherFull"];
            parsedElement["dayNumber"] = scheduleElement["Day"];
            parsedElement["weekNumber"] = scheduleElement["DayNumber"];
            parsedElement["room"] = scheduleElement["Room"]["Name"];
            parsedElement["lessonNumber"] = scheduleElement["Time"]["Time"];
            parsedElement["startTime"] = new Date(
                scheduleElement["Time"]["TimeFrom"],
            ).toLocaleTimeString("ru", {
                hour: "2-digit",
                minute: "2-digit",
            });
            parsedElement["endTime"] = new Date(
                scheduleElement["Time"]["TimeTo"],
            ).toLocaleTimeString("ru", {
                hour: "2-digit",
                minute: "2-digit",
            });

            parsedSchedule.push(parsedElement);
        }

        return parsedSchedule;
    });
};

/**
 * Checks if there is a new schedule and updates the storaged one if needed
 *
 * @return {Promise<boolean>} True if there is a new schedule
 */
const updateSchedule = async function () {
    const isExamsTime = new RegExp(/<\/span> Сессия<\/a><\/li>/).exec(
        documentHTML,
    );
    if (isExamsTime) return Promise.resolve(false);

    saveKeyValue(group + "-examsUpdateTime", Number.MAX_VALUE);
    return getNewSchedule().then((newSchedule) =>
        loadValueByKey(group + "-orig").then((oldSchedule) => {
            if (
                newSchedule &&
                Object.keys(newSchedule).length &&
                JSON.stringify(newSchedule) !== JSON.stringify(oldSchedule)
            ) {
                saveKeyValue(group + "-orig", newSchedule).then(() =>
                    saveKeyValue(group + "-updateTime", Date.now()),
                );
                return true;
            }

            return false;
        }),
    );
};

/**
 * Gets the exams schedule if it is session time
 */
const updateExamsSchedule = function () {
    const source = new RegExp(/id=["']forang["'].*>(.*)<\/div>/).exec(
        documentHTML,
    )[1];
    const jsonData = JSON.parse(source);
    const disciplines = jsonData["dises"];
    const schedule = [];

    for (const element of disciplines) {
        const controlForm = element["formControl"]["name"];
        if (controlForm !== "Экзамен") continue;

        let teachersString = "";
        element["preps"].forEach(
            (teacher) => (teachersString += `► ${teacher["name"]}\n`),
        );

        const examName = element["name"];
        const consDateTime = parseExamUTCDateTime(
            element["date_cons"],
            element["time_cons"],
        );
        const examDateTime = parseExamUTCDateTime(
            element["date_exam"],
            element["time_exam"],
        );

        schedule.push([
            [
                {
                    name: `${examName}\n` + teachersString,
                    type: "Конс",
                    location: element["room_cons"],
                    time: element["time_cons"],
                },
            ],
            consDateTime.valueOf(),
        ]);

        schedule.push([
            [
                {
                    name: `${examName}\n` + teachersString,
                    type: "Экз",
                    location: element["room_exam"],
                    time: element["time_exam"],
                },
            ],
            examDateTime.valueOf(),
        ]);
    }

    schedule.sort((a, b) => a[1] - b[1]);

    saveKeyValue(group + "-exams", schedule).then(() =>
        saveKeyValue(group + "-examsUpdateTime", Date.now()),
    );
};

/**
 * Converts the exam date to the {@link Date} object
 *
 * @param examDate - The original date
 * @param examTime - The original time
 * @return {Date} The converted date
 */
const parseExamUTCDateTime = function (examDate, examTime) {
    // prettier-ignore
    const monthStringToNumber = {
        "января": 0,
        "февраля": 1,
        "июня": 5,
        "июля": 6,
    };

    const [day, monthString, year] = examDate.split(" ");
    const [hour, minute] = examTime.split(":");

    // To use time in GMT+3
    return new Date(
        Date.UTC(year, monthStringToNumber[monthString], day, hour, minute) -
            3 * hourLength,
    );
};

/**
 * Gets the schedule by sending a request and passing the protection(?) with setting the cookie
 *
 * @return {Promise<Object>} A JSON object containing the schedule
 */
const getNewSchedule = function () {
    return sendRequest("https://miet.ru/schedule/data", "POST").then(
        (responseText) => {
            const cookie = RegExp(/wl=(.*);path=\//).exec(responseText);
            if (cookie) {
                // noinspection JSUnresolvedReference
                metabrowser.cookies.set({
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
        },
    );
};

/**
 * Does the whole magic
 */
const onAction = function () {
    console.log(Date.now());
    setGroupAndHTML().then(() => {
        loadValueByKey(group + "-updateTime").then((timestamp) => {
            if (Date.now() - timestamp > updateCheckPeriod || !timestamp)
                updateSchedule().then((updated) => {
                    if (updated)
                        parseSchedule().then((parsedSchedule) =>
                            countSchedule(parsedSchedule),
                        );
                });
        });

        loadValueByKey(group + "-examsUpdateTime").then((examsTimestamp) => {
            if (
                Date.now() - examsTimestamp > updateCheckPeriod ||
                !examsTimestamp
            )
                updateExamsSchedule();
        });
    });
};

// noinspection JSUnresolvedReference,JSDeprecatedSymbols
metabrowser.runtime.onStartup.addListener(onAction);

// noinspection JSUnresolvedReference,JSDeprecatedSymbols
metabrowser.runtime.onInstalled.addListener(onAction);

// noinspection JSUnresolvedReference,JSDeprecatedSymbols
metabrowser.runtime.onMessage.addListener(async (request) => {
    if (request.action === "checkUpdates") onAction();
});

// metabrowser.storage.local.clear();
// metabrowser.storage.local.get().then((data) => console.log(data));
