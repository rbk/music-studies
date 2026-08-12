const Routes = () => {
    const {state} = useContext(AppContext);
    const route = state.navigation.currentPage;
    return (
        <div className="routes-container">
            {route === 'home' && <About />}
        </div>
    )
}
