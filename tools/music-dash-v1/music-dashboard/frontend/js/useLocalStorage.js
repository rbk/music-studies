function dispatchStorageEvent(key, newValue) {
    window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
}

const setLocalStorageItem = (key, value) => {
    const stringifiedValue = JSON.stringify(value);
    window.localStorage.setItem(key, stringifiedValue);
    dispatchStorageEvent(key, stringifiedValue);
};

const removeLocalStorageItem = (key) => {
    window.localStorage.removeItem(key);
    dispatchStorageEvent(key, null);
};

const getLocalStorageItem = (key) => {
    return window.localStorage.getItem(key);
};

const useLocalStorageSubscribe = (callback) => {
    window.addEventListener("storage", callback);
    return () => window.removeEventListener("storage", callback);
};

const getLocalStorageServerSnapshot = () => {
    throw Error("useLocalStorage is a client-only hook");
};

function useLocalStorage(key, initialValue) {
    const getSnapshot = () => getLocalStorageItem(key);

    const store = React.useSyncExternalStore(
        useLocalStorageSubscribe,
        getSnapshot,
        getLocalStorageServerSnapshot
    );

    const setState = React.useCallback(
        (v) => {
            try {
                const nextState = typeof v === "function" ? v(JSON.parse(store)) : v;

                if (nextState === undefined || nextState === null) {
                    removeLocalStorageItem(key);
                } else {
                    setLocalStorageItem(key, nextState);
                }
            } catch (e) {
                console.warn(e);
            }
        },
        [key, store]
    );

    React.useEffect(() => {
        if (
            getLocalStorageItem(key) === null &&
            typeof initialValue !== "undefined"
        ) {
            setLocalStorageItem(key, initialValue);
        }
    }, [key, initialValue]);

    return [store ? JSON.parse(store) : initialValue, setState];
}

/** Clipboard */
function oldSchoolCopy(text) {
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = text;
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    document.execCommand("copy");
    document.body.removeChild(tempTextArea);
}

function useCopyToClipboard() {
    const [state, setState] = React.useState(null);

    const copyToClipboard = React.useCallback((value) => {
        const handleCopy = async () => {
            try {
                if (navigator?.clipboard?.writeText) {
                    await navigator.clipboard.writeText(value);
                    setState(value);
                } else {
                    throw new Error("writeText not supported");
                }
            } catch (e) {
                oldSchoolCopy(value);
                setState(value);
            }
        };

        handleCopy();
    }, []);

    return [state, copyToClipboard];
}