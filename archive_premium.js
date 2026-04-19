
// Premium Local Archive System V2

const STORAGE_KEY = "pope_archive_v2";

function getArchives() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveArchives(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function addArchive(entry) {
    const archives = getArchives();
    archives.push({
        id: Date.now(),
        date: new Date().toISOString(),
        favorite: false,
        title: entry.title || "Sans titre",
        type: entry.type || "général",
        prompt: entry.prompt,
        response: entry.response
    });
    saveArchives(archives);
}

function toggleFavorite(id) {
    const archives = getArchives().map(a => {
        if (a.id === id) a.favorite = !a.favorite;
        return a;
    });
    saveArchives(archives);
}

function renameArchive(id, newTitle) {
    const archives = getArchives().map(a => {
        if (a.id === id) a.title = newTitle;
        return a;
    });
    saveArchives(archives);
}

function filterByDate(start, end) {
    return getArchives().filter(a => {
        const d = new Date(a.date);
        return d >= new Date(start) && d <= new Date(end);
    });
}

function filterByType(type) {
    return getArchives().filter(a => a.type === type);
}
