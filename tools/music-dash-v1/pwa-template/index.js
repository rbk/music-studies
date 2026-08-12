const { useEffect, useState, useContext, createContext } = React;

const About = () => {
    return (
        <div className="about-container">
            <h1>About</h1>
            <p>TBD</p>
        </div>
    )
}

const defaultAppState = {
    navigation: {
        isLoading: false,
        currentPage: 'about',
        pages: [
            {id: 'about', label: 'About'},
        ]
    },
}
const AppContext = createContext(defaultAppState);

function App() {
    const [state, setState] = useLocalStorage('app-state', defaultAppState);

    useEffect(() => {
        console.log('state change')
    }, [state])

    // TODO example API request on load.
    useEffect(() => {
        const getData = async () => {
            // TODO For example, you could get some todos from an API https://dummyjson.com/todos
        }
        void getData()
    }, []);

    return (
        <AppContext.Provider value={{state, setState}}>
            <div className="container">
                <Header />
                <Routes />

                <pre className="mt3 hide">
                    <h1>Debug</h1>
                    {JSON.stringify(state.user, null, 2)}
                </pre>
            </div>
        </AppContext.Provider>
    );
}


const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(<App />);
