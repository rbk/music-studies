const Header = () => {
    const {state, setState} = useContext(AppContext);
    const navigate = (page) => {
        setState({
            ...state,
            navigation: {
                ...state.navigation,
                currentPage: page
            },
        });
    }
    const activeNavItem = state.navigation.currentPage;

    const resetApp = () => {
        const yes = confirm('Delete everything?');
        if (yes) {
            setState({
                ...defaultAppState
            })
        }
    }

    return (
        <div className="header lg-flex justify-between">
            <div className="logo">
                <h1>LOGO HEADER</h1>
            </div>
            <div className="navigation flex">
                {state.navigation.pages && state.navigation.pages.map((x) => {
                    const activeClass = (activeNavItem === x.id) ? 'active' : '';
                    return (
                        <div key={x.id} onClick={() => navigate(x.id)} className="ml2">
                            <button className={activeClass}>{x.label}</button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
