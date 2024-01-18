# Better web-ORIOKS

[![Firefox](https://img.shields.io/badge/Firefox_&_Android-7538c7?style=flat&logo=Firefox-Browser&logoColor=white)](https://addons.mozilla.org/ru/firefox/addon/better-web-orioks/)
[![Google Chrome](https://img.shields.io/badge/Google_Chrome-4285F4?style=flat&logo=GoogleChrome&logoColor=white)](https://chromewebstore.google.com/detail/better-web-orioks/lfklcdejbjncohabmalekhndjjafoacm?hl=ru)
[![Opera](https://img.shields.io/badge/Opera_|_скоро-FF1B2D?style=flat&logo=Opera&logoColor=white)](#better-web-orioks)
[![Edge](https://img.shields.io/badge/Edge_|_скоро-0078D7?style=flat&logo=Microsoft-edge&logoColor=white)](#better-web-orioks)
[![Built with Codeium](https://codeium.com/badges/main)](https://codeium.com)

Это небольшое браузерное расширение — в том числе и адаптированное под мобильные
устройства, — попытка починить сайт ОРИОКСа для более удобного и приятного его
использования

Совместимо с [Dark Reader](https://github.com/darkreader/darkreader) _(рекомендую)_

---

### Что конкретно делает расширение:

- **Чинит подсчёт баллов**: учитываются все полученные за семестр баллы, даже если соответствующие
  контрольные мероприятия по плану ещё не наступили, и делает это лучше встроенного функционала
- **Меняет окрашивание баллов**: в частности, зачётные дисциплины при наборе половины баллов
  становятся зелёными. Ну и вследствие перерасчёта всех сумм остальные дисциплины тоже выглядят
  как минимум не хуже оригинала
- **Дорабатывает расписание**: добавляет преподавателя, улучшает принцип отображения ближайших занятий
    - В том числе **добавляет расписание сессии** по окончании семестра
- **Улучшает внешний вид**: меняет некоторые размеры элементов для лучшей читаемости, а также
  подскругляет углы у откровенно прямоугольных элементов

<details>
<summary style="font-size: large; font-weight: bold">Скриншоты</summary>

- Главная страница (новости)
![Главная страница](screenshots/main-page.png)


- Страница с расписанием + экзамены
![Расписание](screenshots/studying-page-exams.png)

</details>

Некоторые детали [указаны ниже](#faqчаво-но-это-ответы)

---

### Установка:

1. Установите расширение из подходящего магазина расширений (кликабельные [бейджики наверху](#better-web-orioks))
2. ???
3. PROFIT
4. **[Firefox] _Опционально_**: автообновление расширения для `наилучшего опыта использования`:
    1. `Ctrl + Shift + A` или `☰ -> Настройки -> Расширения и темы`
    2. Находим `Better web-ORIOKS` и нажимаем
    3. `Автоматическое обновление -> Включено`

---

### FAQ/ЧаВо, но это ответы:

- Меняется количество баллов на стандартной раскладке "балл", и, соответсвенно, проценты
  на "%", а на раскладке "сум" остаётся оригинальное количество, ну вдруг кому интересно
- Проценты больше 100 оставлены специально, так забавнее с точки зрения автора
- Расписание учитывает тип недели, день и время для отображения незакончившихся пар
  текущего дня или, при их отсутствии, ближайшего, их имеющего (в отличие от оригинальной
  реализации)
- Расписание игнорирует занятия в УВЦ (он же военная кафедра), потому что ~~нормальных~~
  обычных людей это отвлекает, а кому надо, те и сами в курсе
- В расписание добавлены ФИО преподавателей, они берутся со [страницы расписания](https://miet.ru/schedule),
  грубо говоря (на деле с того же сервера, откуда и данные для той страницы), так что могут
  не соответствовать действительности, но тут автор полностью невиновный. А для экзаменов указаны
  преподаватели, что указаны прямо в ОРИОКСе
- Проверка обновления данных расписания происходит при запуске браузера (профиля браузера), установке/обновлении
  расширения или посещении [запросе к] `orioks.miet.ru/*` раз в 6 часов
- Касательно Manifest: в репозитории лежит две версии, вторая для Firefox (в том числе Android),
  а третья, соответственно, для остального. Пока для мобильной версии иначе совсем никак, а для
  старшей банально удобнее _(хотя, конечно, не для сборки...)_

---

### TODO _(оно же планы)_:

- [ ] Адаптация и выпуск в Google Chrome и подобных
- [ ] Графическая информация о баллах по типам контрольных мероприятий?
- [ ] Встроенная тёмная тема?
- [x] ~~Переезд на Manifest V3~~
- [x] ~~Переработка подгрузки расписаний~~
- [x] ~~"Освежение" интерфейса скруглёнными углами~~
- [x] ~~Отображение экзаменов в расписании~~

---

### Контакты:

- **Предложения, ошибки, вопросы**: [GitHub Issues](https://github.com/Psychosoc1al/better-web-orioks/issues)
- **Telegram на крайний случай**: [@TTa3lCblJlou](https://t.me/TTa3lCblJlou) _(это типа пажылой...)_