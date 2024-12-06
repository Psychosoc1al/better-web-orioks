let metabrowser = chrome;
try {
    metabrowser = browser;
} catch (e) {}
const hourLengthInMS = 1000 * 60 * 60;

let infoObject;

/**
 * Save a key-value pair to the storage
 *
 * @param {string} key - The key to save
 * @param {Object} value - The value to save
 */
const saveKeyValue = (key, value) =>
    metabrowser.storage.local.set({ [key]: value });

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
 * @param {string} group - The group to get schedule if needed
 * @return {Promise<string>} A promise that resolves with the response text
 */
const sendRequest = (url, method, group = "") =>
    fetch(url, {
        method: method,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Set-Cookie": "SameSite=None; Secure",
        },
        body: group ? `group=${group}` : undefined,
        credentials: "include",
    }).then((response) => response.text());

/**
 * Gets the group by sending a request and saving the basic information to process
 *
 * @return {Promise<Object>} The object containing all the needed information
 */
const getAllInformation = () =>
    loadValueByKey("info").then((info) =>
        sendRequest("https://orioks.miet.ru/student/student", "GET").then(
            (responseText) => {
                const newGroup = /selected>([А-Я]+-\d\d[А-Я]*)/.exec(
                    responseText,
                )[1];
                const newSchedule = JSON.parse(
                    /id=["']forang["'].*>(.*)<\/div>/.exec(responseText)[1],
                );
                const newIsExamsTime =
                    !!/<\/span> Сессия<\/a><\/li>/.exec(responseText) ||
                    newSchedule["dises"].some(
                        (element) => element["date_exam"],
                    );
                const subjects = newSchedule["dises"].map(
                    (element) => element["name"],
                );

                if (info?.isSemesterChange && newIsExamsTime) {
                    const semesterCheckString =
                        new Date().getMonth() < 6 ? "Весенний" : "Осенний";

                    return getNewSchedule(newGroup).then(
                        (newOriginalSchedule) =>
                            newOriginalSchedule["Semestr"].includes(
                                semesterCheckString,
                            )
                                ? {
                                      group: newGroup,
                                      isExamsTime: true,
                                      originalSchedule: newOriginalSchedule,
                                      countedSchedule:
                                          JSON.stringify(
                                              newOriginalSchedule,
                                          ) ===
                                          JSON.stringify(info.originalSchedule)
                                              ? info.countedSchedule
                                              : undefined,
                                      isSemesterChange: true,
                                      forcedExamsTime: false,
                                      subjects: subjects,
                                  }
                                : info,
                    );
                } else if (newIsExamsTime)
                    return {
                        group: newGroup,
                        isExamsTime: newIsExamsTime,
                        originalSchedule: newSchedule,
                        countedSchedule:
                            JSON.stringify(newSchedule) ===
                            JSON.stringify(info?.originalSchedule)
                                ? info.countedSchedule
                                : undefined,
                        isSemesterChange: false,
                        forcedExamsTime: true,
                        subjects: subjects,
                    };
                else
                    return getNewSchedule(newGroup).then(
                        (newOriginalSchedule) => {
                            return {
                                group: newGroup,
                                isExamsTime: false,
                                originalSchedule: newOriginalSchedule,
                                countedSchedule:
                                    JSON.stringify(newOriginalSchedule) ===
                                    JSON.stringify(info?.originalSchedule)
                                        ? info.countedSchedule
                                        : undefined,
                                isSemesterChange: false,
                                forcedExamsTime: false,
                                subjects: subjects,
                            };
                        },
                    );
            },
        ),
    );

/**
 * Gets the schedule by sending a request and passing the protection(?) with setting the cookie
 *
 * @param {string} group - The group to get schedule for
 * @return {Promise<Object>} A JSON object containing the schedule
 */
const getNewSchedule = (group) =>
    sendRequest("https://miet.ru/schedule/data", "POST", group)
        .then((responseText) => {
            const cookie = /wl=(.*);path=\//.exec(responseText);
            if (!cookie) return Promise.resolve(responseText);

            return metabrowser.cookies
                .set({
                    url: "https://miet.ru/",
                    name: "wl",
                    value: cookie[1],
                })
                .then(() =>
                    sendRequest("https://miet.ru/schedule/data", "POST", group),
                );
        })
        .then((responseText) => {
            try {
                return JSON.parse(responseText);
            } catch {
                return { Semestr: [] };
            }
        });

/**
 * Counts the full schedule cycle and saves it
 *
 * @param {Object} parsedSchedule - The parsed (processed) schedule
 */
const countSchedule = (parsedSchedule) => {
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
    for (const [weekNum, weekString] of weekStrings.entries()) {
        const sundaySchedule = structuredClone(
            fullSchedule[weekStrings[(weekNum + 1) % 4]][
                Math.floor((weekNum + 1) / 4)
            ],
        );
        sundaySchedule.forEach((day) => (day.dateOffset += 1));
        fullSchedule[weekString].unshift(sundaySchedule);
    }

    return fullSchedule;
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
const getClosestLessons = (
    schedule,
    searchWeekNumber,
    startDay,
    daysOffset = 0,
    weekChanged = false,
) => {
    let searchDayNumber = startDay + daysOffset - 1;
    let closestLessons = [];
    let nextOffset = daysOffset;

    if (searchDayNumber === -1) {
        searchWeekNumber = ++searchWeekNumber % 4;
        searchDayNumber = 0;
        nextOffset++;
        weekChanged = true;
    }

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
                !lesson.name.includes("УВЦ"),
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
const collapseDuplicatedLessons = (closestDays) => {
    for (const day of closestDays) {
        const collapsedLessons = [];
        let currentLesson;
        let currentLessonNumber = 0;
        let lessonCount = 1;

        for (let i = 0; i < day.lessons.length; i++) {
            if (
                day.lessons[i].name === day.lessons[i + 1]?.name &&
                day.lessons[i].type === day.lessons[i + 1]?.type
            ) {
                lessonCount++;
                continue;
            }

            if (lessonCount > 1) {
                currentLesson = day.lessons[currentLessonNumber];
                const amountPart = ` (${lessonCount} пар${
                    lessonCount < 5 ? "ы" : ""
                })`;

                currentLesson.name = currentLesson.name.replace(
                    "\n",
                    amountPart + " \n",
                );
                currentLesson.endTime = day.lessons[i].endTime;
                currentLesson.time = currentLesson.time.replace(
                    /\n\d\d:\d\d.*/,
                    "\n" + day.lessons[i].endTime,
                );
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
 * @return {Array<Object>} An array of parsed and formatted schedule elements
 */
const parseSchedule = () => {
    const parsedSchedule = [];

    for (const scheduleElement of infoObject.originalSchedule["Data"]) {
        const parsedElement = {};

        const lessonOriginalName = scheduleElement["Class"]["Name"];
        const lessonTypeMatch = /\[(.*)]/.exec(lessonOriginalName);
        let lessonType = "";
        let lessonName;

        if (lessonTypeMatch) {
            lessonName = /(.*) \[/.exec(lessonOriginalName)[1];
            lessonType = lessonTypeMatch[1];
        } else lessonName = lessonOriginalName;

        if (lessonName.startsWith("Дв ")) {
            lessonName = lessonName.replace("Дв ", "");

            if (!infoObject.subjects.includes(lessonName)) continue;
        }

        if (lessonName.includes("Практическая подготовка")) continue;

        parsedElement["name"] = `${lessonName}
                                ► ${scheduleElement["Class"]["TeacherFull"]}\n`;

        parsedElement["type"] =
            lessonType === "Лек"
                ? "Лекция"
                : lessonType === "Пр"
                  ? "Практика"
                  : "Лабораторная";
        parsedElement["dayNumber"] = scheduleElement["Day"];
        parsedElement["weekNumber"] = scheduleElement["DayNumber"];
        parsedElement["location"] =
            scheduleElement["Class"]["Form"] === "Дистанционное"
                ? "Дист"
                : scheduleElement["Room"]["Name"].replace(" (м)", "");
        parsedElement["lessonNumber"] = scheduleElement["Time"]["Time"];
        parsedElement["startTime"] = scheduleElement["Time"]["TimeFrom"]
            .split("T")[1]
            .slice(0, 5);

        if (parsedElement["startTime"] === "12:00") {
            parsedElement["startTime"] = "12:00/30";
            parsedElement["endTime"] = "13:50/20";
        } else
            parsedElement["endTime"] = scheduleElement["Time"]["TimeTo"]
                .split("T")[1]
                .slice(0, 5);

        parsedElement["time"] =
            `${parsedElement["startTime"]}\n ~ \n${parsedElement["endTime"]}`;

        parsedSchedule.push(parsedElement);
    }

    return parsedSchedule;
};

/**
 * Gets the exams schedule if it is session time
 */
const countExamsSchedule = () => {
    const jsonData = infoObject.originalSchedule;
    const disciplines = jsonData["dises"];
    const schedule = [];

    for (const element of disciplines) {
        if (!element["time_exam"]) continue;

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
    if (schedule.slice()) return schedule;
};

/**
 * Converts the exam date to the {@link Date} object
 *
 * @param examDate - The original date
 * @param examTime - The original time
 * @return {Date} The converted date
 */
const parseExamUTCDateTime = (examDate, examTime) => {
    // prettier-ignore
    const monthStringToNumber = {
        "января": 0,
        "февраля": 1,
        "июня": 5,
        "июля": 6,
    };

    const [day, monthString, year] = examDate.split(" ");
    const [hour, minute] = examTime.split(":");

    // To use time in GMT+3 as UTC
    return new Date(
        Date.UTC(year, monthStringToNumber[monthString], day, hour, minute) -
            3 * hourLengthInMS,
    );
};

/**
 * Starts the whole magic
 */
const runUpdate = () => {
    getAllInformation()
        .then((info) => (infoObject = info))
        .then(() => {
            if (!infoObject.countedSchedule)
                infoObject.countedSchedule =
                    infoObject.isExamsTime && !infoObject.isSemesterChange
                        ? countExamsSchedule()
                        : countSchedule(parseSchedule());

            if (
                infoObject?.originalSchedule?.dises &&
                infoObject.countedSchedule.slice(-1)[0][1] < Date.now()
            ) {
                loadValueByKey("info").then((res) => {
                    infoObject.isSemesterChange = true;
                    saveKeyValue("info", infoObject);

                    if (JSON.stringify(res) !== JSON.stringify(infoObject))
                        runUpdate();
                });

                return;
            }

            saveKeyValue("info", infoObject);
        })
        .catch((e) => {
            console.error(e);

            saveKeyValue("info", undefined);
        });
};

/**
 * Sets the schedule update alarm if needed
 */
const setUpdateAlarm = () =>
    metabrowser.alarms
        .get("checkUpdates")
        .then((alarm) => {
            if (alarm) throw new Error();

            metabrowser.alarms.create("checkUpdates", { periodInMinutes: 360 });
        })
        .then(() => saveKeyValue("info", undefined))
        .then(() => runUpdate())
        .catch(() => ({}));

metabrowser.runtime.onInstalled.addListener(() => setUpdateAlarm());
metabrowser.runtime.onMessage.addListener((request) => {
    if (request.action === "checkUpdates") runUpdate();
    else if (request.action === "setUpdateAlarm") setUpdateAlarm();
});

metabrowser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "checkUpdates") runUpdate();
});
