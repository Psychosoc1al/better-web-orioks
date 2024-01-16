// noinspection JSUnresolvedReference
/**
 * Retrieves the value associated with the given key
 *
 * @param {string} key - The key to retrieve the value for
 * @return {Promise<Object>} - The value associated with the given key
 */
const loadValueByKey = (key) =>
    chrome.storage.local.get(key).then((res) => res[key]);

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
        setExamsSchedule();
        return;
    }

    let stringCurrentWeek = currentWeekElement.innerText.split("\n")[1];
    if (!stringCurrentWeek)
        stringCurrentWeek = currentWeekElement.innerText
            .split(" ")
            .slice(3)
            .join(" ");
    // const stringCurrentWeek = "1 знаменатель";

    loadValueByKey(group).then((fullSchedule) => {
        if (Object.keys(fullSchedule).length === 0) {
            setExamsSchedule();
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

        let teachersString = "";
        element["preps"].forEach(
            (teacher) => (teachersString += `► ${teacher["name"]}\n`),
        );

        const examName = element["name"];
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
                }) +
                    (consDate.getDate() - currentDate.getDate()
                        ? ` (дней: ${
                              consDate.getDate() - currentDate.getDate()
                          })`
                        : ` (сегодня)`),
                [
                    {
                        name: `${examName}\n` + teachersString,
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
                }) +
                    (examDate.getDate() - currentDate.getDate()
                        ? ` (дней: ${
                              examDate.getDate() - currentDate.getDate()
                          })`
                        : ` (сегодня)`),
                [
                    {
                        name: `${examName}\n` + teachersString,
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
 * Converts the exam date to the {@link Date} object
 *
 * @param examDate - The original date
 * @param examTime - The original time
 * @return {Date} The converted date
 */
const parseExamDate = function (examDate, examTime) {
    // prettier-ignore
    const monthStringToNumber = {
        "января": 0,
        "февраля": 1,
        "июня": 5,
        "июля": 6,
    };

    const [day, monthString, year] = examDate.split(" ");
    const [hour, minute] = examTime.split(":");

    return new Date(year, monthStringToNumber[monthString], day, hour, minute);
};

/**
 * Waits for the element to appear to start the script
 *
 * @param selector - The CSS selector of the element
 * @return {Promise<void>} A promise to be resolved when the element is found
 */
const waitForElement = function (selector) {
    return new Promise((resolve) => {
        if (document.querySelector(selector)) return resolve();

        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
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

/**
 * Executes the necessary actions when the page is opened.
 */
const onPageOpen = function () {
    waitForElement("#forang").then(() => {
        updateGrades();
        setSchedule();
        requestPermissions();
    });
};

onPageOpen();

const permissionsToRequest = {
    permissions: ["cookies", "storage"],
    origins: [
        "https://miet.ru/schedule/data",
        "https://orioks.miet.ru/student/student",
    ],
};

async function requestPermissions() {
    function onResponse(response) {
        if (response) {
            console.log("Permission was granted");
        } else {
            console.log("Permission was refused");
        }
        return browser.permissions.getAll();
    }

    const response = await browser.permissions.request(permissionsToRequest);
    const currentPermissions = await onResponse(response);

    console.log(`Current permissions:`, currentPermissions);
}
