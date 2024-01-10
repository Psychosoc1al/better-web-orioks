// noinspection JSUnresolvedReference
/**
 * Save a key-value pair to the storage
 *
 * @param {string} key - The key to save
 * @param {Object} value - The value to save
 */
const saveKeyValue = (key, value) =>
    browser.storage.local.set({ [key]: value });

// noinspection JSUnresolvedReference
/**
 * Retrieves the value associated with the given key
 *
 * @param {string} key - The key to retrieve the value for
 * @return {Promise<Object>} - The value associated with the given key
 */
const loadValueByKey = (key) =>
    browser.storage.local.get(key).then((res) => res[key]);

const group = document.body
    ? document
          .querySelector('select[name="student_id"] option')
          .innerText.split(" ")[0]
    : "";

const weeksNumbers = {
    "1 числитель": 0,
    "1 знаменатель": 1,
    "2 числитель": 2,
    "2 знаменатель": 3,
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
 * Gets the schedule by sending a request and passing the protection(?) with setting the cookie
 *
 * @return {Object} A JSON object containing the schedule
 */
const requestSchedule = function () {
    // noinspection JSUnresolvedVariable
    return browser.runtime
        .sendMessage({
            group: group,
        })
        .then(
            (res) => res.response,
            (res) => console.error(res),
        );
};

/**
 * Parses the schedule data received from the server
 *
 * @return {Promise<Array<Object>>} An array of parsed and formatted schedule elements
 */
const parseSchedule = function () {
    return requestSchedule().then((responseJSON) => {
        const parsedSchedule = [];

        for (const responseJSONElement of responseJSON["Data"]) {
            const scheduleElement = {};

            scheduleElement["name"] = responseJSONElement["Class"]["Name"];
            scheduleElement["teacher"] =
                responseJSONElement["Class"]["TeacherFull"];
            scheduleElement["dayNumber"] = responseJSONElement["Day"];
            scheduleElement["weekNumber"] = responseJSONElement["DayNumber"];
            scheduleElement["room"] = responseJSONElement["Room"]["Name"];
            scheduleElement["lessonNumber"] =
                responseJSONElement["Time"]["Time"];
            scheduleElement["startTime"] = new Date(
                responseJSONElement["Time"]["TimeFrom"],
            ).toLocaleTimeString("ru", {
                hour: "2-digit",
                minute: "2-digit",
            });
            scheduleElement["endTime"] = new Date(
                responseJSONElement["Time"]["TimeTo"],
            ).toLocaleTimeString("ru", {
                hour: "2-digit",
                minute: "2-digit",
            });

            parsedSchedule.push(scheduleElement);
        }

        return parsedSchedule;
    });
};

/**
 * Updates the schedule and processes it
 */
const processSchedule = function () {
    loadValueByKey("schedule").then((schedule) => {
        parseSchedule().then((parsedSchedule) => {
            saveKeyValue("schedule", parsedSchedule);

            if (!schedule) {
                // noinspection JSUnresolvedReference
                browser.runtime
                    .sendMessage({ reload: true })
                    .then(() => onPageOpen());
            }
        });

        if (schedule) {
            const parsedSchedule = JSON.parse(JSON.stringify(schedule));
            const closestLessons = getClosestLessons(parsedSchedule);

            if (closestLessons.length) setSchedule(closestLessons);
            else setExamsSchedule();
        }
    });
};

/**
 * Sets the schedule based on the current time and day or on finds the closest lessons
 *
 * @param {Object} schedule - The whole schedule object
 * @param {number} daysOffset - The offset in days from the current day to start search
 * @param {boolean} weekChanged - Whether the week has changed while searching the closest day
 * @return {Object[]} The closest two days lessons list
 */
const getClosestLessons = function (
    schedule,
    daysOffset = 0,
    weekChanged = false,
) {
    let currentTime, currentDayNumber;
    let date = new Date();
    let utcDate = new Date(
        date.getTime() + date.getTimezoneOffset() * 60 * 1000,
    );
    date = new Date(utcDate.getTime() + 3 * 60 * 60 * 1000);

    if (daysOffset === 0) {
        currentTime = date.toLocaleTimeString("ru", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
        currentDayNumber = date.getDay();
    } else {
        date.setDate(date.getDate() + daysOffset);

        currentTime = "00:00";
        currentDayNumber = date.getDay();
    }

    const currentWeekElement = document.querySelector(".small");
    if (!currentWeekElement) return [];

    let stringCurrentWeek = currentWeekElement.innerText.split("\n")[1];
    if (!stringCurrentWeek)
        stringCurrentWeek = currentWeekElement.innerText
            .split(" ")
            .slice(3)
            .join(" ");
    let searchWeekNumber = weeksNumbers[stringCurrentWeek];
    let searchDayNumber = currentDayNumber - 1;
    let closestLessons = [];
    let nextOffset = daysOffset;

    if (typeof searchWeekNumber === "undefined") return [];

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
                (currentDayNumber === searchDayNumber
                    ? lesson.endTime >= currentTime
                    : true) &&
                !lesson.teacher.includes("УВЦ"),
        );
    }

    closestLessons.sort((a, b) => {
        return a.lessonNumber > b.lessonNumber ? 1 : -1;
    });

    date = new Date();
    date.setDate(date.getDate() + nextOffset - 1);
    const stringDate = date.toLocaleDateString("ru", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
    });

    if (daysOffset === 0)
        return [
            {
                date: stringDate,
                lessons: closestLessons,
            },
        ].concat(getClosestLessons(schedule, nextOffset, weekChanged));
    return [
        {
            date: stringDate,
            lessons: closestLessons,
        },
    ];
};

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

        for (let i = 0; i < day.lessons.length; i++)
            if (day.lessons[i].name === day.lessons[i + 1]?.name) lessonCount++;
            else {
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
                    collapsedLessons.push(currentLesson);
                } else collapsedLessons.push(day.lessons[currentLessonNumber]);

                currentLessonNumber += lessonCount;
                lessonCount = 1;
            }

        day.lessons = collapsedLessons;
    }

    return closestDays;
};

/**
 * Sets the schedule based on the closest lessons
 *
 * @param closestDays - The list of closest days with lessons (see {@link getClosestLessons()})
 */
const setSchedule = function (closestDays) {
    const source = document.querySelector("#forang");
    const jsonData = JSON.parse(source.textContent);
    const schedule = [];

    closestDays = collapseDuplicatedLessons(closestDays);
    for (let i = 0; i < closestDays.length; i++) {
        schedule[i] = [];
        schedule[i][0] = closestDays[i].date;
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
                            ► ${lesson.teacher}
                            `,
                type: lessonType,
                location: lesson.room,
                time:
                    lesson.startTime === "12:00"
                        ? "12:00/30"
                        : lesson.startTime,
            });
        }
    }

    jsonData["schedule"] = schedule;
    source.textContent = JSON.stringify(jsonData);
};

/**
 * Converts the exam date to the {@link Date} object
 *
 * @param examDate - The original date
 * @param examTime - The original time
 * @return {Date} The converted date
 */
const parseExamDate = function (examDate, examTime) {
    // prettier-ignore
    const monthStringToNumber = {
        'января': 0,
        'февраля': 1,
        'июня': 5,
        'июля': 6,
    }

    const [day, monthString, year] = examDate.split(" ");
    const [hour, minute] = examTime.split(":");

    return new Date(year, monthStringToNumber[monthString], day, hour, minute);
};

/**
 * Gets the exams schedule if it is session time
 */
const setExamsSchedule = function () {
    const source = document.querySelector("#forang");
    const jsonData = JSON.parse(source.textContent);
    const disciplines = jsonData["dises"];
    const schedule = [];

    let currentDate = new Date();
    let utcDate = new Date(
        currentDate.getTime() + currentDate.getTimezoneOffset() * 60 * 1000,
    );
    currentDate = new Date(utcDate.getTime() + 3 * 60 * 60 * 1000);

    for (const element of disciplines) {
        const controlForm = element["formControl"]["name"];
        if (controlForm !== "Экзамен") continue;

        const examName = element["science"]["name"];
        const consDate = parseExamDate(
            element["date_cons"],
            element["time_cons"],
        );
        const examDate = parseExamDate(
            element["date_exam"],
            element["time_exam"],
        );

        if (currentDate < consDate)
            schedule.push([
                consDate.toLocaleDateString("ru", {
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                }) + ` (дней: ${consDate.getDate() - currentDate.getDate()})`,
                [
                    {
                        name: `${examName}
                        `,
                        type: "Конс",
                        location: element["room_cons"],
                        time: element["time_cons"],
                    },
                ],
                consDate,
            ]);

        if (currentDate < examDate)
            schedule.push([
                examDate.toLocaleDateString("ru", {
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                }) + ` (дней: ${examDate.getDate() - currentDate.getDate()})`,
                [
                    {
                        name: `${examName}
                        `,
                        type: "Экз",
                        location: element["room_exam"],
                        time: element["time_exam"],
                    },
                ],
                examDate,
            ]);
    }

    schedule.sort((a, b) => a[2] - b[2]);

    jsonData["schedule"] = schedule;
    source.textContent = JSON.stringify(jsonData);
};

/**
 * Executes the necessary actions when the page is opened.
 */
const onPageOpen = function () {
    updateGrades();
    processSchedule();
};

if (group) onPageOpen();
