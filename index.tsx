

// FIX: Added necessary imports for React, ReactDOM, and ReactCrop to resolve module errors.
import React from 'react';
import ReactDOM from 'react-dom/client';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';


// =======================================================
// --- services/apiService.ts (Backend Dependent) ---
// =======================================================
const apiService = (() => {
    const API_ENDPOINT = '/api/data';

    // This is now the single source of truth for getting data from the server.
    const getDatabase = async () => {
        try {
            const response = await fetch(API_ENDPOINT);
            if (!response.ok) {
                console.error("Failed to fetch database, status:", response.status);
                throw new Error('Could not fetch data from the server.');
            }
            return response.json();
        } catch (error) {
            console.error("Network error fetching database:", error);
            // We throw the error so components can handle it (e.g., show an error message)
            throw error;
        }
    };

    // This is the single source for saving data to the server.
    const saveDatabase = async (db) => {
        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(db),
            });
            if (!response.ok) {
                console.error("Failed to save database, status:", response.status);
                throw new Error('Could not save data to the server.');
            }
        } catch (error) {
            console.error("Network error saving database:", error);
            throw error;
        }
    };

    // The public methods now get the entire DB, make a change, and save it back.
    // This is a simple but effective strategy for this type of database.
    return {
        getUsers: async () => {
            const db = await getDatabase();
            return db.users;
        },
        saveUsers: async (users) => {
            const db = await getDatabase();
            db.users = users;
            await saveDatabase(db);
        },
        
        getRoutine: async () => {
            const db = await getDatabase();
            return db.routine;
        },
        saveRoutine: async (routine) => {
            const db = await getDatabase();
            db.routine = routine;
            await saveDatabase(db);

        },

        getCompletedTasks: async () => {
            const db = await getDatabase();
            return db.completedTasks;
        },
        saveCompletedTasks: async (tasks) => {
            const db = await getDatabase();
            db.completedTasks = tasks;
            await saveDatabase(db);
        },
        
        getStudents: async () => {
            const db = await getDatabase();
            return db.students;
        },
        saveStudents: async (students) => {
            const db = await getDatabase();
            db.students = students;
            await saveDatabase(db);
        },

        getUserSettings: async (username) => {
            const db = await getDatabase();
            return db.userSettings[username] || { emailNotifications: true, pushNotifications: true };
        },
        saveUserSettings: async (username, settings) => {
            const db = await getDatabase();
            if (!db.userSettings) db.userSettings = {};
            db.userSettings[username] = settings;
            await saveDatabase(db);
        },
        
        getNotifications: async () => {
            const db = await getDatabase();
            return db.notifications;
        },
        saveNotifications: async (notifications) => {
            const db = await getDatabase();
            db.notifications = notifications;
            await saveDatabase(db);
        },

        getFeedback: async () => {
            const db = await getDatabase();
            return db.feedback;
        },
        saveFeedback: async (feedback) => {
            const db = await getDatabase();
            db.feedback = feedback;
            await saveDatabase(db);
        },

        getSyllabusData: async () => {
            const db = await getDatabase();
            return db.syllabusData;
        },
        saveSyllabusData: async (data) => {
            const db = await getDatabase();
            db.syllabusData = data;
            await saveDatabase(db);
        },
    };
})();


// =======================================================
// --- contexts/NotificationContext.tsx ---
// =======================================================
const NotificationContext = React.createContext(undefined);

const NotificationProvider = ({ children }) => {
    const [notification, setNotification] = React.useState(null);

    const clearNotification = React.useCallback(() => {
        setNotification(null);
    }, []);

    const addNotification = React.useCallback((type, title, message) => {
        setNotification({ type, title, message });
        setTimeout(() => {
            clearNotification();
        }, 5000);
    }, [clearNotification]);
    
    return (
        <NotificationContext.Provider value={{ notification, addNotification, clearNotification }}>
            {children}
        </NotificationContext.Provider>
    );
};

const useNotification = () => {
    const context = React.useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

// =======================================================
// --- contexts/AuthContext.tsx ---
// =======================================================
const AuthContext = React.createContext(undefined);

const AuthProvider = ({ children }) => {
    const [user, setUser] = React.useState(null);
    const [isLoggedIn, setIsLoggedIn] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(true); // Added loading state

    // Simulate session check
    React.useEffect(() => {
        const sessionUser = sessionStorage.getItem('currentUser');
        if(sessionUser) {
            try {
                const parsedUser = JSON.parse(sessionUser);
                setUser(parsedUser);
                setIsLoggedIn(true);
            } catch (e) {
                sessionStorage.removeItem('currentUser');
            }
        }
        setIsLoading(false);
    }, []);

    const login = React.useCallback(async (username, passwordIn) => {
        const users = await apiService.getUsers();
        const foundUser = users.find(u => u.username === username && u.password === passwordIn);
        if (foundUser) {
            const { password, ...userToSet } = foundUser;
            setUser(userToSet);
            setIsLoggedIn(true);
            sessionStorage.setItem('currentUser', JSON.stringify(userToSet));
            return userToSet;
        }
        return null;
    }, []);

    const register = React.useCallback(async (userData) => {
        let users = await apiService.getUsers();
        if (users.some(u => u.username === userData.username)) {
            return null; // Username exists
        }
        const newUser = { ...userData, role: 'student', profileImage: null };
        users.push(newUser);
        await apiService.saveUsers(users);

        const { password, ...userToSet } = newUser;
        setUser(userToSet);
        setIsLoggedIn(true);
        sessionStorage.setItem('currentUser', JSON.stringify(userToSet));
        return userToSet;
    }, []);

    const logout = React.useCallback(() => {
        setUser(null);
        setIsLoggedIn(false);
        sessionStorage.removeItem('currentUser');
    }, []);
    
    const updateUser = React.useCallback(async (updatedUserData) => {
        let currentUsername = user?.username;
        const userToUpdate = { ...user, ...updatedUserData };
        setUser(userToUpdate);
        
        let users = await apiService.getUsers();
        const userIndex = users.findIndex(u => u.username === currentUsername);
        
        if (userIndex > -1) {
            const originalUser = users[userIndex];
            // Preserve password if not changed
            users[userIndex] = { ...originalUser, ...updatedUserData };
        }
        await apiService.saveUsers(users);
        
        // Update session storage if username changed
        sessionStorage.setItem('currentUser', JSON.stringify(userToUpdate));
        
    }, [user]);

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center"><div className="loader"></div></div>;
    }

    return (
        <AuthContext.Provider value={{ isLoggedIn, user, login, logout, register, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};

const useAuth = () => {
    const context = React.useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// =======================================================
// --- components/Modal.tsx ---
// =======================================================
const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
            <div
                className={`bg-card-bg rounded-lg shadow-xl w-full ${maxWidth} relative animate-modalSlideIn flex flex-col max-h-[90vh]`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 sm:p-6 border-b border-border-color">
                    <h2 className="text-xl font-bold text-white">{title}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors text-2xl"
                    >
                        &times;
                    </button>
                </div>
                <div className="p-4 sm:p-6 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

// =======================================================
// --- components/Notification.tsx ---
// =======================================================
const Notification = () => {
    const { notification, clearNotification } = useNotification();

    if (!notification) return null;

    const iconClasses = {
        success: 'fas fa-check-circle text-green-500',
        error: 'fas fa-exclamation-circle text-red-500',
        warning: 'fas fa-exclamation-triangle text-yellow-500',
    };

    return (
        <div className={`fixed top-5 right-5 w-11/12 max-w-sm bg-card-bg shadow-2xl rounded-lg p-4 z-[100] border-l-4 ${
            notification.type === 'success' ? 'border-green-500' : 
            notification.type === 'error' ? 'border-red-500' : 'border-yellow-500'
        } transform transition-transform duration-300 ease-in-out ${notification ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex items-start">
                <i className={`${iconClasses[notification.type]} text-2xl mr-4`}></i>
                <div className="flex-1">
                    <h4 className="font-bold text-white">{notification.title}</h4>
                    <p className="text-sm text-gray-300">{notification.message}</p>
                </div>
                <button onClick={clearNotification} className="ml-4 text-gray-500 hover:text-white">
                    <i className="fas fa-times"></i>
                </button>
            </div>
        </div>
    );
};

// =======================================================
// --- components/Particles.tsx ---
// =======================================================
const Particles = () => {
    const canvasRef = React.useRef(null);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId;
        let particles = [];
        const mouse = { x: -1000, y: -1000, radius: 100 };

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            createParticles();
        };

        class Particle {
            // FIX: Declare class properties to satisfy TypeScript
            x: number;
            y: number;
            size: number;
            speedX: number;
            speedY: number;
            
            constructor(x: number, y: number, size: number, speedX: number, speedY: number) {
                this.x = x;
                this.y = y;
                this.size = size;
                this.speedX = speedX;
                this.speedY = speedY;
            }

            draw() {
                if(!ctx) return;
                ctx.fillStyle = 'rgba(76, 201, 240, 0.7)';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.closePath();
                ctx.fill();
            }

            update() {
                if (this.x > canvas.width || this.x < 0) this.speedX = -this.speedX;
                if (this.y > canvas.height || this.y < 0) this.speedY = -this.speedY;
                
                this.x += this.speedX;
                this.y += this.speedY;
            }
        }

        const createParticles = () => {
            particles = [];
            const numberOfParticles = (canvas.height * canvas.width) / 9000;
            for (let i = 0; i < numberOfParticles; i++) {
                const size = Math.random() * 2 + 1;
                const x = Math.random() * (canvas.width - size * 2) + size;
                const y = Math.random() * (canvas.height - size * 2) + size;
                const speedX = Math.random() * 0.4 - 0.2;
                const speedY = Math.random() * 0.4 - 0.2;
                particles.push(new Particle(x, y, size, speedX, speedY));
            }
        };

        const connect = () => {
             if(!ctx) return;
            let opacityValue = 1;
            for (let a = 0; a < particles.length; a++) {
                for (let b = a; b < particles.length; b++) {
                    const distance = Math.sqrt(
                        (particles[a].x - particles[b].x) * (particles[a].x - particles[b].x) +
                        (particles[a].y - particles[b].y) * (particles[a].y - particles[b].y)
                    );

                    if (distance < 100) {
                        opacityValue = 1 - (distance / 100);
                        ctx.strokeStyle = `rgba(76, 201, 240, ${opacityValue})`;
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(particles[a].x, particles[a].y);
                        ctx.lineTo(particles[b].x, particles[b].y);
                        ctx.stroke();
                    }
                }
            }
        };
        
        const connectToMouse = () => {
            if(!ctx) return;
            for (let i = 0; i < particles.length; i++) {
                const distance = Math.sqrt(
                    (particles[i].x - mouse.x) * (particles[i].x - mouse.x) +
                    (particles[i].y - mouse.y) * (particles[i].y - mouse.y)
                );
                 if (distance < mouse.radius) {
                    const opacityValue = 1 - (distance / mouse.radius);
                    ctx.strokeStyle = `rgba(67, 97, 238, ${opacityValue})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.stroke();
                }
            }
        };

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            connect();
            connectToMouse();
            animationFrameId = requestAnimationFrame(animate);
        };

        const handleMouseMove = (event) => {
            mouse.x = event.x;
            mouse.y = event.y;
        };

        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('mousemove', handleMouseMove);
        
        resizeCanvas();
        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="fixed top-0 left-0 w-full h-full z-[-1] interactive-bg animate-gradientBG overflow-hidden">
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full"></canvas>
        </div>
    );
};

// =======================================================
// --- components/Footer.tsx ---
// =======================================================
const Footer = () => {
    return (
        <footer className="bg-secondary text-white text-center p-6 mt-auto">
            <div className="container mx-auto">
                <p>&copy; 2025 Taifur's EduSys. All rights reserved.</p>
            </div>
        </footer>
    );
};

// =======================================================
// --- components/Header.tsx ---
// =======================================================
const Header = ({ navigate }) => {
    const { user, logout } = useAuth();
    const [isAccountMenuOpen, setAccountMenuOpen] = React.useState(false);
    const [isNotificationMenuOpen, setNotificationMenuOpen] = React.useState(false);
    const [notifications, setNotifications] = React.useState([]);
    
    const accountMenuRef = React.useRef(null);
    const notificationMenuRef = React.useRef(null);

    React.useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const data = await apiService.getNotifications();
                setNotifications(data);
            } catch (error) {
                console.error("Failed to load notifications", error);
            }
        };
        fetchNotifications();
    }, []);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
                setAccountMenuOpen(false);
            }
            if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target)) {
                setNotificationMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    const handleNotificationOpen = async () => {
        setNotificationMenuOpen(!isNotificationMenuOpen);
        if(!isNotificationMenuOpen) {
            const readNotifications = notifications.map(n => ({ ...n, read: true }));
            setNotifications(readNotifications);
            await apiService.saveNotifications(readNotifications);
        }
    };
    
    const getInitials = (name) => {
        if (!name) return '';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    return (
        <header className="bg-primary text-white shadow-lg sticky top-0 z-40">
            <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center cursor-pointer" onClick={() => navigate('dashboard')}>
                        <img src="logo.png" alt="EduSys Logo" className="h-12 w-auto rounded-md" />
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                        <div className="relative" ref={notificationMenuRef}>
                            <button onClick={handleNotificationOpen} className="relative p-2 rounded-full hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary focus:ring-white">
                                <i className="fas fa-bell text-xl"></i>
                                {unreadCount > 0 && (
                                    <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-xs flex items-center justify-center">{unreadCount}</span>
                                )}
                            </button>
                            {isNotificationMenuOpen && (
                                <div className="origin-top-right absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-card-bg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                    <div className="py-1 max-h-[400px] overflow-y-auto">
                                        {notifications.length > 0 ? notifications.map(n => (
                                            <div key={n.id} className="px-4 py-3 border-b border-border-color last:border-b-0">
                                                <p className="text-sm font-semibold text-white">{n.title}</p>
                                                <p className="text-sm text-gray-400">{n.message}</p>
                                                <p className="text-xs text-gray-500 mt-1">{n.time}</p>
                                            </div>
                                        )) : (
                                            <div className="px-4 py-3 text-sm text-gray-400">No new notifications</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="relative" ref={accountMenuRef}>
                            <button onClick={() => setAccountMenuOpen(!isAccountMenuOpen)} className="flex items-center justify-center h-10 w-10 rounded-full bg-white/20 hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary focus:ring-white overflow-hidden">
                                {user?.profileImage ? (
                                    <img src={user.profileImage} alt="Avatar" className="h-full w-full object-cover" />
                                ) : (
                                    <span className="font-bold">{user ? getInitials(user.name) : <i className="fas fa-user"></i>}</span>
                                )}
                            </button>
                            {isAccountMenuOpen && (
                                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-card-bg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                    <div className="py-1">
                                        <button onClick={() => { navigate('profile'); setAccountMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-text-color hover:bg-dark-light">
                                            <i className="fas fa-user w-4"></i> Profile
                                        </button>
                                        <button onClick={() => { navigate('settings'); setAccountMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-text-color hover:bg-dark-light">
                                            <i className="fas fa-cog w-4"></i> Settings
                                        </button>
                                        <div className="border-t border-border-color my-1"></div>
                                        <button onClick={() => { logout(); setAccountMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-text-color hover:bg-dark-light">
                                            <i className="fas fa-sign-out-alt w-4"></i> Logout
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

// =======================================================
// --- components/Navigation.tsx ---
// =======================================================
const NavLink = ({ page, label, currentPage, navigate }) => {
    const isActive = currentPage === page;
    return (
        <li>
            <a
                href="#"
                onClick={(e) => { e.preventDefault(); navigate(page); }}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-primary text-white' : 'text-text-color hover:bg-dark-light hover:text-white'}`}
            >
                {label}
            </a>
        </li>
    );
};

const Navigation = ({ currentPage, navigate }) => {
    const [isMobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    const navLinksProps = { currentPage, navigate };

    return (
        <nav className="bg-card-bg shadow-md z-30 relative">
            <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-end md:justify-start h-12">
                    <div className="hidden md:block">
                        <ul className="ml-10 flex items-baseline space-x-4">
                            <NavLink {...navLinksProps} page="dashboard" label="Dashboard" />
                            <NavLink {...navLinksProps} page="timetable" label="Timetable" />
                            <NavLink {...navLinksProps} page="progress" label="Progress" />
                            <NavLink {...navLinksProps} page="syllabus" label="Syllabus" />
                            <NavLink {...navLinksProps} page="feedback" label="Feedback" />
                        </ul>
                    </div>
                    <div className="md:hidden">
                        <button onClick={() => setMobileMenuOpen(!isMobileMenuOpen)} className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white">
                            <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
                        </button>
                    </div>
                </div>
            </div>
            {isMobileMenuOpen && (
                <div className="md:hidden absolute w-full bg-card-bg shadow-lg">
                    <ul className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                       <NavLink {...navLinksProps} page="dashboard" label="Dashboard" />
                       <NavLink {...navLinksProps} page="timetable" label="Timetable" />
                       <NavLink {...navLinksProps} page="progress" label="Progress" />
                       <NavLink {...navLinksProps} page="syllabus" label="Syllabus" />
                       <NavLink {...navLinksProps} page="feedback" label="Feedback" />
                    </ul>
                </div>
            )}
        </nav>
    );
};

// =======================================================
// --- components/StudentSyllabusView.tsx ---
// =======================================================
const StudentSyllabusView = ({ studentUsername, viewerRole }) => {
    const { addNotification } = useNotification();
    
    const [userSyllabus, setUserSyllabus] = React.useState({});
    const [currentSubject, setCurrentSubject] = React.useState(null);
    const [newSubjectName, setNewSubjectName] = React.useState('');
    const [newChapterName, setNewChapterName] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(true);

    const isReadOnly = viewerRole === 'teacher';

    const loadSyllabus = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const allData = await apiService.getSyllabusData();
            const userData = allData[studentUsername] || {};
            setUserSyllabus(userData);
            const subjects = Object.keys(userData);
            if (subjects.length > 0) {
                setCurrentSubject(subjects[0]);
            } else {
                setCurrentSubject(null);
            }
        } catch (error) {
            addNotification('error', 'Load Failed', 'Could not load syllabus data.');
        } finally {
            setIsLoading(false);
        }
    }, [studentUsername, addNotification]);
    
    React.useEffect(() => {
        loadSyllabus();
    }, [loadSyllabus]);

    const items = React.useMemo(() => {
        return currentSubject ? userSyllabus[currentSubject]?.items || [] : [];
    }, [currentSubject, userSyllabus]);


    const saveSyllabus = async (newSyllabus) => {
        setUserSyllabus(newSyllabus);
        const allData = await apiService.getSyllabusData();
        allData[studentUsername] = newSyllabus;
        await apiService.saveSyllabusData(allData);
    };

    const handleAddNewSubject = async () => {
        if (!newSubjectName.trim() || isReadOnly) return;
        if (userSyllabus.hasOwnProperty(newSubjectName)) {
            addNotification('warning', 'Subject Exists', 'A syllabus for this subject already exists.');
            return;
        }
        const newSyllabus = {
            ...userSyllabus,
            [newSubjectName]: { items: [] }
        };
        await saveSyllabus(newSyllabus);
        setCurrentSubject(newSubjectName);
        setNewSubjectName('');
        addNotification('success', 'Subject Added', `Syllabus for ${newSubjectName} created.`);
    };

    const handleAddChapter = async (e) => {
        e.preventDefault();
        if (!currentSubject || !newChapterName.trim() || isReadOnly) return;

        const newChapter = {
            id: `${Date.now()}`,
            text: newChapterName.trim(),
            completed: false,
        };
        
        const updatedItems = [...items, newChapter];
        const updatedSyllabus = {
            ...userSyllabus,
            [currentSubject]: { items: updatedItems },
        };
        await saveSyllabus(updatedSyllabus);
        setNewChapterName('');
    };
    
    const handleDeleteChapter = async (itemId) => {
        if (!currentSubject || isReadOnly) return;

        if (window.confirm('Are you sure you want to delete this chapter?')) {
            const updatedItems = items.filter(item => item.id !== itemId);
            const updatedSyllabus = {
                ...userSyllabus,
                [currentSubject]: { items: updatedItems },
            };
            await saveSyllabus(updatedSyllabus);
            addNotification('success', 'Chapter Removed', 'The chapter has been deleted.');
        }
    };

    const handleToggleComplete = async (itemId) => {
        if (!currentSubject || isReadOnly) return;
        const updatedItems = items.map(item => item.id === itemId ? { ...item, completed: !item.completed } : item);
        const updatedSyllabus = {
            ...userSyllabus,
            [currentSubject]: { items: updatedItems },
        };
        await saveSyllabus(updatedSyllabus);
    };

    const { completedCount, totalCount, progress } = React.useMemo(() => {
        const total = items.length;
        const completed = items.filter(i => i.completed).length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { completedCount: completed, totalCount: total, progress: percentage };
    }, [items]);

    const subjects = Object.keys(userSyllabus);

    if (isLoading) {
        return <div className="text-center p-8"><div className="loader mx-auto"></div></div>;
    }

    return (
        <div>
            {viewerRole === 'student' && <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3"><i className="fas fa-book-open"></i>Syllabus Tracker</h1>}
            <div className="bg-card-bg p-4 rounded-lg shadow-lg mb-8 flex flex-wrap items-center gap-4">
                <div className="flex-grow">
                    <label htmlFor="subject-select" className="text-sm font-medium text-gray-300 mr-2">Subject:</label>
                    <select id="subject-select" value={currentSubject || ''} onChange={(e) => setCurrentSubject(e.target.value)} className="px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary" disabled={subjects.length === 0}>
                         {subjects.length > 0 ? ( subjects.map(sub => <option key={sub} value={sub}>{sub}</option>) ) : ( <option>No subjects yet</option> )}
                    </select>
                </div>
                {!isReadOnly && (
                    <div className="flex items-center gap-2">
                         <input type="text" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} placeholder="New Subject Name" className="px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary"/>
                        <button onClick={handleAddNewSubject} className="bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 transition-colors">Add Subject</button>
                    </div>
                )}
            </div>

            {currentSubject ? (
                <div className="bg-card-bg p-6 rounded-lg shadow-lg">
                    <h2 className="text-xl font-bold text-white mb-4">Checklist for <span className="text-accent">{currentSubject}</span></h2>
                    <div className="mb-6">
                        <div className="flex justify-between text-sm text-gray-300 mb-1"><span>Progress</span><span>{completedCount} / {totalCount} Completed</span></div>
                        <div className="w-full bg-dark-light rounded-full h-4"><div className="bg-green-500 h-4 rounded-full text-xs text-white flex items-center justify-center font-bold" style={{ width: `${progress}%` }}>{progress > 10 && `${progress}%`}</div></div>
                    </div>
                    
                    {!isReadOnly && (
                        <form onSubmit={handleAddChapter} className="flex gap-2 mb-6">
                            <input type="text" value={newChapterName} onChange={(e) => setNewChapterName(e.target.value)} placeholder="Enter new chapter name..." className="flex-grow px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary"/>
                            <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-md hover:bg-secondary transition-colors">Add Chapter</button>
                        </form>
                    )}

                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {items.length > 0 ? items.map(item => (
                            <div key={item.id} className={`flex items-center bg-dark-light p-3 rounded-md transition-all ${item.completed ? 'opacity-60' : ''}`}>
                                <input type="checkbox" checked={item.completed} onChange={() => handleToggleComplete(item.id)} disabled={isReadOnly} className="h-5 w-5 rounded bg-border-color border-gray-500 text-primary focus:ring-primary mr-4 flex-shrink-0 disabled:cursor-not-allowed cursor-pointer"/>
                                <span className={`flex-1 text-gray-200 ${item.completed ? 'line-through text-gray-500' : ''}`}>{item.text}</span>
                                {!isReadOnly && (
                                     <button onClick={() => handleDeleteChapter(item.id)} className="ml-4 text-gray-500 hover:text-red-500 transition-colors">
                                        <i className="fas fa-trash"></i>
                                    </button>
                                )}
                            </div>)) : (
                            <div className="text-center py-10 text-gray-500"><p>No chapters yet.</p>{!isReadOnly && <p>Add a chapter above to get started!</p>}</div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="text-center py-20 bg-card-bg rounded-lg text-gray-400">
                     <i className="fas fa-folder-plus text-5xl mb-4"></i><h2 className="text-2xl font-bold text-white mb-2">No Syllabus Found</h2><p>Create a syllabus by adding a new subject above.</p>
                </div>
            )}
        </div>
    );
};


// =======================================================
// --- pages/AuthModal.tsx ---
// =======================================================
const AuthModal = ({ isOpen, onClose, initialTab = 'login' }) => {
    const [activeTab, setActiveTab] = React.useState(initialTab);
    const { login, register } = useAuth();
    const { addNotification } = useNotification();
    const [isLoading, setIsLoading] = React.useState(false);
    
    const [loginUsername, setLoginUsername] = React.useState('');
    const [loginPassword, setLoginPassword] = React.useState('');

    const [regName, setRegName] = React.useState('');
    const [regUsername, setRegUsername] = React.useState('');
    const [regPassword, setRegPassword] = React.useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const user = await login(loginUsername, loginPassword);
            if (user) {
                addNotification('success', 'Login Successful', `Welcome back, ${user.name}!`);
                onClose();
            } else {
                addNotification('error', 'Login Failed', 'Invalid username or password.');
            }
        } catch (error) {
            addNotification('error', 'Login Error', 'Could not connect to the server.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const user = await register({
                name: regName,
                username: regUsername,
                password: regPassword,
            });
            if (user) {
                addNotification('success', 'Registration Successful', `Welcome, ${user.name}!`);
                onClose();
            } else {
                addNotification('error', 'Registration Failed', 'Username may already be taken.');
            }
        } catch(error) {
             addNotification('error', 'Registration Error', 'Could not connect to the server.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const buttonClasses = "w-full bg-primary text-white font-bold py-2 px-4 rounded-md hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Welcome to EduSys" maxWidth="max-w-md">
            <div className="flex border-b border-border-color mb-6">
                <button
                    onClick={() => setActiveTab('login')}
                    className={`flex-1 py-2 text-center font-medium transition-colors ${activeTab === 'login' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
                >
                    Login
                </button>
                <button
                    onClick={() => setActiveTab('register')}
                    className={`flex-1 py-2 text-center font-medium transition-colors ${activeTab === 'register' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
                >
                    Register
                </button>
            </div>

            {activeTab === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="form-group">
                        <label className="text-sm font-medium text-gray-300" htmlFor="loginUsername">Username</label>
                        <input id="loginUsername" type="text" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} className="w-full px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary" required />
                    </div>
                    <div className="form-group">
                        <label className="text-sm font-medium text-gray-300" htmlFor="loginPassword">Password</label>
                        <input id="loginPassword" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary" required />
                    </div>
                    <button type="submit" className={buttonClasses} disabled={isLoading}>{isLoading ? 'Logging in...' : 'Login'}</button>
                </form>
            )}

            {activeTab === 'register' && (
                <form onSubmit={handleRegister} className="space-y-4">
                     <div className="form-group">
                        <label className="text-sm font-medium text-gray-300" htmlFor="regName">Full Name</label>
                        <input id="regName" type="text" value={regName} onChange={e => setRegName(e.target.value)} className="w-full px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary" required />
                    </div>
                    <div className="form-group">
                        <label className="text-sm font-medium text-gray-300" htmlFor="regUsername">Username</label>
                        <input id="regUsername" type="text" value={regUsername} onChange={e => setRegUsername(e.target.value)} className="w-full px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary" required />
                    </div>
                    <div className="form-group">
                        <label className="text-sm font-medium text-gray-300" htmlFor="regPassword">Password</label>
                        <input id="regPassword" type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} className="w-full px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary" required />
                    </div>
                    <button type="submit" className={buttonClasses} disabled={isLoading}>{isLoading ? 'Registering...' : 'Register'}</button>
                </form>
            )}
        </Modal>
    );
};

// =======================================================
// --- pages/WelcomePage.tsx ---
// =======================================================
const WelcomePage = () => {
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [initialTab, setInitialTab] = React.useState('login');

    const openModal = (tab) => {
        setInitialTab(tab);
        setIsModalOpen(true);
    };

    return (
        <React.Fragment>
            <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
                <img src="logo.png" alt="EduSys Logo" className="h-32 w-auto rounded-lg mb-8" />
                <h1 className="text-4xl md:text-6xl font-bold text-white text-shadow-lg mb-4">
                    Welcome to Taifur's EduSys
                </h1>
                <p className="text-lg md:text-xl text-white/90 max-w-2xl mb-8">
                    A comprehensive teacher-student portal for managing education efficiently.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                        onClick={() => openModal('login')}
                        className="px-8 py-3 text-lg font-semibold text-primary bg-white rounded-full transition-transform transform hover:scale-105 shadow-lg">
                        Login
                    </button>
                    <button 
                        onClick={() => openModal('register')}
                        className="px-8 py-3 text-lg font-semibold text-white bg-transparent border-2 border-white rounded-full transition-colors hover:bg-white hover:text-primary">
                        Sign Up
                    </button>
                </div>
            </div>
            <AuthModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                initialTab={initialTab} 
            />
        </React.Fragment>
    );
};

// =======================================================
// --- pages/DashboardPage.tsx ---
// =======================================================
const DashboardCard = ({ icon, title, description, buttonText, onClick }) => (
    <div className="bg-card-bg p-6 rounded-lg shadow-lg flex flex-col items-center text-center transition-transform transform hover:-translate-y-1">
        <i className={`${icon} text-4xl text-primary mb-4`}></i>
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 mb-4 flex-grow">{description}</p>
        <button onClick={onClick} className="mt-auto bg-transparent border border-primary text-primary font-semibold py-2 px-4 rounded-md hover:bg-primary hover:text-white transition-colors">
            {buttonText}
        </button>
    </div>
);

const DashboardPage = ({ navigate }) => {
    const { user } = useAuth();
    
    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                <i className="fas fa-tachometer-alt"></i>
                Dashboard
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <DashboardCard 
                    icon="fas fa-calendar-alt"
                    title="Timetable"
                    description="View and manage your daily and weekly schedule."
                    buttonText="View Timetable"
                    onClick={() => navigate('timetable')}
                />
                <DashboardCard 
                    icon="fas fa-chart-line"
                    title="Student Progress"
                    description="Track and monitor the performance of your students."
                    buttonText="View Progress"
                    onClick={() => navigate('progress')}
                />
                 <DashboardCard 
                    icon="fas fa-book-open"
                    title="Syllabus"
                    description="Manage and track your course syllabus and chapters."
                    buttonText="View Syllabus"
                    onClick={() => navigate('syllabus')}
                />
                <DashboardCard 
                    icon="fas fa-comment-dots"
                    title="Feedback"
                    description="Submit and review feedback for continuous improvement."
                    buttonText="View Feedback"
                    onClick={() => navigate('feedback')}
                />
                {user?.role === 'admin' && (
                    <DashboardCard
                        icon="fas fa-users-cog"
                        title="User Management"
                        description="Add, edit, and manage user accounts and roles."
                        buttonText="Manage Users"
                        onClick={() => navigate('user-management')}
                    />
                )}
            </div>
        </div>
    );
};

// =======================================================
// --- pages/ProfilePage.tsx ---
// =======================================================
const ProfilePage = () => {
    const { user, updateUser } = useAuth();
    const { addNotification } = useNotification();
    const [formData, setFormData] = React.useState({ name: '', username: '', phone: '', dob: '', address: '', profileImage: null });
    // FIX: Added type for file input ref.
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isSaving, setIsSaving] = React.useState(false);

    // State for image cropper
    const [imgSrc, setImgSrc] = React.useState('');
    // FIX: Added type for crop state for react-image-crop.
    const [crop, setCrop] = React.useState<Crop>();
    // FIX: Added type for completedCrop state for react-image-crop.
    const [completedCrop, setCompletedCrop] = React.useState<PixelCrop | null>(null);
    const [isCropModalOpen, setCropModalOpen] = React.useState(false);
    // FIX: Added type for image ref.
    const imgRef = React.useRef<HTMLImageElement>(null);
    // FIX: Added type for canvas ref.
    const previewCanvasRef = React.useRef<HTMLCanvasElement>(null);

    React.useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                username: user.username || '',
                phone: user.phone || '',
                dob: user.dob || '',
                address: user.address || '',
                profileImage: user.profileImage || null
            });
        }
    }, [user]);

    const getInitials = (name) => {
        if (!name) return '';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setCrop(undefined); // Reset crop state
            const reader = new FileReader();
            reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
            reader.readAsDataURL(e.target.files[0]);
            setCropModalOpen(true);
        }
    };

    const handleCropImage = () => {
        if (!completedCrop || !previewCanvasRef.current || !imgRef.current) {
            return;
        }
        const image = imgRef.current;
        const canvas = previewCanvasRef.current;
        const crop = completedCrop;

        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('No 2d context');
        }

        const pixelRatio = window.devicePixelRatio;
        canvas.width = crop.width * pixelRatio;
        canvas.height = crop.height * pixelRatio;

        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(
            image,
            crop.x * scaleX,
            crop.y * scaleY,
            crop.width * scaleX,
            crop.height * scaleY,
            0,
            0,
            crop.width,
            crop.height
        );
        
        const base64Image = canvas.toDataURL('image/jpeg');
        setFormData(prev => ({ ...prev, profileImage: base64Image }));
        setCropModalOpen(false);
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await updateUser(formData);
            addNotification('success', 'Profile Updated', 'Your profile has been saved successfully.');
        } catch (error) {
            addNotification('error', 'Update Failed', 'Could not save profile to the server.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) {
        return <div>Loading profile...</div>;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3"><i className="fas fa-user"></i>My Profile</h1>
            <div className="bg-card-bg p-6 sm:p-8 rounded-lg shadow-lg max-w-4xl mx-auto">
                <form onSubmit={handleSubmit}>
                    <div className="flex flex-col items-center mb-8">
                        <div className="relative">
                            <div className="w-32 h-32 rounded-full bg-accent flex items-center justify-center text-white font-bold text-4xl mb-4 overflow-hidden">
                                {formData.profileImage ? (
                                    <img src={formData.profileImage} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <span>{getInitials(formData.name)}</span>
                                )}
                            </div>
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-4 right-0 bg-primary h-8 w-8 rounded-full flex items-center justify-center text-white hover:bg-secondary">
                                <i className="fas fa-camera"></i>
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">{formData.name}</h2>
                        <p className="text-gray-400 capitalize">{user.role}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
                            <input type="text" id="name" value={formData.name} onChange={handleInputChange} className="w-full px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">Username</label>
                            <input type="text" id="username" value={formData.username} onChange={handleInputChange} className="w-full px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary" disabled />
                        </div>
                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-1">Phone Number</label>
                            <input type="tel" id="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                        <div>
                            <label htmlFor="dob" className="block text-sm font-medium text-gray-300 mb-1">Date of Birth</label>
                            <input type="date" id="dob" value={formData.dob} onChange={handleInputChange} className="w-full px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                        <div className="md:col-span-2">
                             <label htmlFor="address" className="block text-sm font-medium text-gray-300 mb-1">Address</label>
                             <textarea id="address" value={formData.address} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary"></textarea>
                        </div>
                    </div>
                    <div className="mt-8 text-right">
                        <button type="submit" className="bg-green-600 text-white font-bold py-2 px-6 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50" disabled={isSaving}>
                            <i className="fas fa-save mr-2"></i>{isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
            
            <canvas ref={previewCanvasRef} style={{ display: 'none' }} />

            <Modal isOpen={isCropModalOpen} onClose={() => setCropModalOpen(false)} title="Crop Profile Picture">
                <div className="flex flex-col items-center">
                    {imgSrc && (
                        <ReactCrop
                            crop={crop}
                            onChange={c => setCrop(c)}
                            onComplete={c => setCompletedCrop(c)}
                            aspect={1}
                            circularCrop
                        >
                            <img ref={imgRef} src={imgSrc} alt="Crop preview" style={{ maxHeight: '70vh' }} />
                        </ReactCrop>
                    )}
                    <button onClick={handleCropImage} className="mt-4 bg-primary text-white font-bold py-2 px-6 rounded-md hover:bg-secondary transition-colors">
                        Crop Image
                    </button>
                </div>
            </Modal>
        </div>
    );
};

// =======================================================
// --- pages/SettingsPage.tsx ---
// =======================================================
const SettingItem = ({ title, description, children }) => (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-dark-light rounded-lg mb-4">
        <div className="mb-2 sm:mb-0">
            <h4 className="font-semibold text-white">{title}</h4>
            <p className="text-sm text-gray-400">{description}</p>
        </div>
        <div>{children}</div>
    </div>
);

const ToggleSwitch = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-14 h-8 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
    </label>
);

const SettingsPage = () => {
    const { user } = useAuth();
    const [settings, setSettings] = React.useState({ emailNotifications: true, pushNotifications: true });
    const { addNotification } = useNotification();

    React.useEffect(() => {
        const fetchSettings = async () => {
            if (user) {
                try {
                    const data = await apiService.getUserSettings(user.username);
                    setSettings(data);
                } catch (error) {
                    addNotification('error', 'Load Failed', 'Could not load user settings.');
                }
            }
        };
        fetchSettings();
    }, [user, addNotification]);

    const handleSettingChange = async (key, value) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        if (user) {
            try {
                await apiService.saveUserSettings(user.username, newSettings);
                const settingName = key === 'emailNotifications' ? 'Email notifications' : 'Push notifications';
                addNotification('success', 'Settings Updated', `${settingName} have been ${value ? 'enabled' : 'disabled'}.`);
            } catch (error) {
                 addNotification('error', 'Save Failed', 'Could not save settings.');
            }
        }
    };
    
    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3"><i className="fas fa-cog"></i>Settings</h1>
            <div className="bg-card-bg p-6 sm:p-8 rounded-lg shadow-lg max-w-4xl mx-auto">
                <div className="mb-8">
                    <h3 className="text-xl font-bold text-white mb-4">Preferences</h3>
                    <SettingItem title="Email Notifications" description="Receive email notifications for important updates">
                        <ToggleSwitch checked={settings.emailNotifications} onChange={(val) => handleSettingChange('emailNotifications', val)} />
                    </SettingItem>
                    <SettingItem title="Push Notifications" description="Receive push notifications on your device">
                        <ToggleSwitch checked={settings.pushNotifications} onChange={(val) => handleSettingChange('pushNotifications', val)} />
                    </SettingItem>
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white mb-4">Account</h3>
                    <SettingItem title="Change Password" description="Update your account password">
                        <button className="bg-transparent border border-primary text-primary font-semibold py-2 px-4 rounded-md hover:bg-primary hover:text-white transition-colors">
                            Change
                        </button>
                    </SettingItem>
                     <SettingItem title="Delete Account" description="Permanently delete your account and all data">
                        <button className="bg-red-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-700 transition-colors">
                            Delete Account
                        </button>
                    </SettingItem>
                </div>
            </div>
        </div>
    );
};

// =======================================================
// --- pages/ManageRoutineModal.tsx ---
// =======================================================
const fullDayNamesManage = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ManageRoutineModal = ({ isOpen, onClose, onSave }) => {
    const [routine, setRoutine] = React.useState({ days: {} });
    const [students, setStudents] = React.useState([]);

    React.useEffect(() => {
        const loadData = async () => {
            if (isOpen) {
                try {
                    const [routineData, studentsData] = await Promise.all([
                        apiService.getRoutine(),
                        apiService.getStudents()
                    ]);
                    setRoutine(routineData);
                    setStudents(studentsData);
                } catch (error) {
                    console.error("Failed to load data for routine modal", error);
                }
            }
        };
        loadData();
    }, [isOpen]);

    const handleSlotChange = (day, slotId, field, value) => {
        setRoutine(prev => {
            const newRoutine = JSON.parse(JSON.stringify(prev));
            const daySlots = newRoutine.days[day];
            const slotIndex = daySlots.findIndex((s) => s.id === slotId);
            if (slotIndex > -1) {
                daySlots[slotIndex][field] = value;
            }
            return newRoutine;
        });
    };

    const handleAddSlot = (day) => {
        const newSlot = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            start: '09:00',
            end: '10:00',
            subject: 'New Subject',
            student: students.length > 0 ? students[0].name : ''
        };
        setRoutine(prev => {
            const newRoutine = JSON.parse(JSON.stringify(prev));
            newRoutine.days[day] = [...(newRoutine.days[day] || []), newSlot];
            return newRoutine;
        });
    };

    const handleDeleteSlot = (day, slotId) => {
        setRoutine(prev => {
            const newRoutine = JSON.parse(JSON.stringify(prev));
            newRoutine.days[day] = newRoutine.days[day].filter((s) => s.id !== slotId);
            return newRoutine;
        });
    };

    const handleSaveRoutine = async () => {
        await apiService.saveRoutine(routine);
        onSave();
    };
    
    const inputClasses = "px-2 py-1 bg-dark text-white border border-border-color rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-sm";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Manage Timetable Routine" maxWidth="max-w-4xl">
            <div className="space-y-6">
                {fullDayNamesManage.map(day => (
                    <div key={day} className="bg-card-bg p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-bold text-white">{day}</h3>
                            <button onClick={() => handleAddSlot(day)} className="bg-green-600 text-white text-xs font-bold py-1 px-2 rounded hover:bg-green-700 transition-colors">
                                <i className="fas fa-plus mr-1"></i> Add Slot
                            </button>
                        </div>
                        <div className="space-y-2">
                            {routine.days[day]?.map(slot => (
                                <div key={slot.id} className="bg-dark-light p-2 rounded-lg flex flex-wrap items-center gap-2">
                                    <input type="time" value={slot.start} onChange={e => handleSlotChange(day, slot.id, 'start', e.target.value)} className={inputClasses} />
                                    <span className="text-gray-400">-</span>
                                    <input type="time" value={slot.end} onChange={e => handleSlotChange(day, slot.id, 'end', e.target.value)} className={inputClasses} />
                                    <input type="text" placeholder="Subject" value={slot.subject} onChange={e => handleSlotChange(day, slot.id, 'subject', e.target.value)} className={`${inputClasses} flex-grow min-w-[100px]`} />
                                    <select value={slot.student} onChange={e => handleSlotChange(day, slot.id, 'student', e.target.value)} className={`${inputClasses} flex-grow min-w-[100px]`}>
                                        <option value="">Select Student</option>
                                        {students.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                    </select>
                                    <button onClick={() => handleDeleteSlot(day, slot.id)} className="bg-red-600 text-white p-2 rounded w-8 h-8 flex-shrink-0 hover:bg-red-700 transition-colors">
                                        <i className="fas fa-trash"></i>
                                    </button>
                                </div>
                            ))}
                            {(!routine.days[day] || routine.days[day]?.length === 0) && <p className="text-gray-500 text-sm px-2">No slots scheduled.</p>}
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-6 pt-4 border-t border-border-color flex justify-end gap-3">
                 <button onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-700 transition-colors">
                    Cancel
                </button>
                <button onClick={handleSaveRoutine} className="bg-primary text-white font-bold py-2 px-6 rounded-md hover:bg-secondary transition-colors">
                    Save Routine
                </button>
            </div>
        </Modal>
    );
};

// =======================================================
// --- pages/TimetablePage.tsx ---
// =======================================================
const TimetablePage = () => {
    const [currentDate, setCurrentDate] = React.useState(new Date());
    const [selectedDate, setSelectedDate] = React.useState(new Date());
    const [isManageModalOpen, setManageModalOpen] = React.useState(false);
    const { user } = useAuth();
    const { addNotification } = useNotification();
    
    const [routine, setRoutine] = React.useState({ days: {} });
    const [completedTasks, setCompletedTasks] = React.useState({});
    const [isLoading, setIsLoading] = React.useState(true);
    
    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const [routineData, tasksData] = await Promise.all([
                apiService.getRoutine(),
                apiService.getCompletedTasks()
            ]);
            setRoutine(routineData);
            setCompletedTasks(tasksData);
        } catch(error) {
            addNotification('error', 'Load Failed', 'Could not load timetable data.');
        } finally {
            setIsLoading(false);
        }
    }, [addNotification]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarDays = React.useMemo(() => {
        const days = [];
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push({ key: `empty-${i}`, empty: true });
        }
        for (let day = 1; day <= daysInMonth; day++) {
            days.push({ key: `${year}-${month}-${day}`, day, date: new Date(year, month, day) });
        }
        return days;
    }, [year, month, firstDayOfMonth, daysInMonth]);

    const changeMonth = (offset) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const handleTaskToggle = async (date, slotId, studentName) => {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        const newCompletedTasks = JSON.parse(JSON.stringify(completedTasks));
        if (!newCompletedTasks[dateStr]) newCompletedTasks[dateStr] = {};
        
        const wasCompleted = !!newCompletedTasks[dateStr][slotId];
        newCompletedTasks[dateStr][slotId] = !wasCompleted;

        setCompletedTasks(newCompletedTasks); // Optimistic update
        
        try {
            await apiService.saveCompletedTasks(newCompletedTasks);

            let students = await apiService.getStudents();
            const studentIndex = students.findIndex(s => s.name === studentName);
            if (studentIndex > -1) {
                students[studentIndex].totalCompleted += wasCompleted ? -1 : 1;
                await apiService.saveStudents(students);
                addNotification('success', 'Task Updated', `Task for ${studentName} marked as ${!wasCompleted ? 'complete' : 'incomplete'}.`);
            }
        } catch (error) {
            addNotification('error', 'Update Failed', 'Could not save task update.');
            loadData(); // Revert optimistic update
        }
    };

    const handleRoutineSave = () => {
        setManageModalOpen(false);
        addNotification('success', 'Routine Saved', 'The timetable has been updated.');
        loadData(); // Reload data after saving
    };
    
    const selectedDayRoutine = routine.days[fullDayNames[selectedDate.getDay()]] || [];

    if (isLoading) {
        return <div className="text-center p-8"><div className="loader mx-auto"></div></div>;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3"><i className="fas fa-calendar-alt"></i>Calendar Timetable</h1>
            <div className="bg-card-bg p-4 sm:p-6 rounded-lg shadow-lg">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <h2 className="text-2xl font-bold text-white">{monthNames[month]} {year}</h2>
                    <div className="flex gap-2">
                        <button onClick={() => changeMonth(-1)} className="bg-transparent border border-primary text-primary font-semibold py-2 px-4 rounded-md hover:bg-primary hover:text-white transition-colors">
                            <i className="fas fa-chevron-left"></i> Prev
                        </button>
                        <button onClick={() => changeMonth(1)} className="bg-transparent border border-primary text-primary font-semibold py-2 px-4 rounded-md hover:bg-primary hover:text-white transition-colors">
                            Next <i className="fas fa-chevron-right"></i>
                        </button>
                         {user?.role === 'admin' && (
                            <button onClick={() => setManageModalOpen(true)} className="bg-primary text-white font-bold py-2 px-4 rounded-md hover:bg-secondary transition-colors">
                                <i className="fas fa-edit mr-2"></i>Manage Routine
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="grid grid-cols-7 gap-1 bg-border-color border border-border-color rounded-lg overflow-hidden">
                    {dayNames.map(day => <div key={day} className="text-center font-bold p-2 bg-primary text-white">{day}</div>)}
                    
                    {calendarDays.map(d => {
                        if (d.empty) return <div key={d.key} className="bg-dark-light"></div>;
                        
                        const dayRoutine = routine.days[fullDayNames[d.date.getDay()]] || [];
                        const dateStr = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}-${String(d.date.getDate()).padStart(2, '0')}`;
                        const tasksForDay = completedTasks[dateStr] || {};
                        const isSelected = selectedDate.toDateString() === d.date.toDateString();
                        const isToday = new Date().toDateString() === d.date.toDateString();

                        return (
                            <div key={d.key} onClick={() => setSelectedDate(d.date)} className={`p-2 min-h-[120px] cursor-pointer transition-colors bg-card-bg hover:bg-dark-light ${isSelected ? 'bg-primary/30' : ''}`}>
                                <div className={`font-bold ${isToday ? 'text-accent' : 'text-white'}`}>{d.day}</div>
                                <div className="space-y-1 mt-1 text-xs">
                                    {dayRoutine.map((task) => (
                                        <div key={task.id} className={`p-1 rounded flex items-center gap-2 ${tasksForDay[task.id] ? 'bg-green-600/50' : 'bg-accent/50'}`}>
                                            {user?.role !== 'student' && (
                                                <input type="checkbox" checked={!!tasksForDay[task.id]} onChange={() => handleTaskToggle(d.date, task.id, task.student)} className="form-checkbox h-3 w-3 text-primary bg-gray-700 border-gray-600 rounded focus:ring-primary"/>
                                            )}
                                            <div className="flex-1 truncate">
                                                <div className="font-bold">{task.subject}</div>
                                                <div>{task.student}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                <div className="mt-6">
                     <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <i className="fas fa-calendar-day"></i> Routine for {selectedDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                     </h3>
                     <div className="mt-4 space-y-2">
                        {selectedDayRoutine.length > 0 ? selectedDayRoutine.map((slot) => (
                             <div key={slot.id} className="bg-dark-light p-3 rounded-lg flex justify-between items-center">
                                 <span className="font-semibold text-primary">{slot.start} - {slot.end}</span>
                                 <div className="text-right">
                                    <div className="text-white font-semibold">{slot.subject}</div>
                                    <div className="text-gray-400 text-sm">{slot.student}</div>
                                 </div>
                             </div>
                        )) : (
                            <p className="text-gray-400">No routine scheduled for this day.</p>
                        )}
                     </div>
                </div>
            </div>
            <ManageRoutineModal isOpen={isManageModalOpen} onClose={() => setManageModalOpen(false)} onSave={handleRoutineSave} />
        </div>
    );
};

// =======================================================
// --- pages/ProgressPage.tsx ---
// =======================================================
const StudentCard = ({ student, onUpdate }) => {
    const [days, setDays] = React.useState(student.daysToComplete);
    const { user } = useAuth();
    const { addNotification } = useNotification();
    
    const cycles = Math.floor(student.totalCompleted / student.daysToComplete);
    const currentCompleted = student.totalCompleted % student.daysToComplete;
    const progressPercentage = student.daysToComplete > 0 ?
        Math.min(100, Math.round((currentCompleted / student.daysToComplete) * 100)) : 0;
        
    const handleUpdateDays = async () => {
        let students = await apiService.getStudents();
        const studentIndex = students.findIndex(s => s.name === student.name);
        if (studentIndex > -1) {
            students[studentIndex].daysToComplete = days;
            await apiService.saveStudents(students);
            addNotification('success', 'Updated', `Days to complete for ${student.name} updated.`);
            onUpdate();
        }
    };
    
    const handleRemoveStudent = async () => {
        if (window.confirm(`Are you sure you want to remove ${student.name}?`)) {
            let students = await apiService.getStudents();
            students = students.filter(s => s.name !== student.name);
            await apiService.saveStudents(students);
            addNotification('success', 'Removed', `${student.name} has been removed.`);
            onUpdate();
        }
    };

    return (
        <div className="bg-card-bg p-5 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">{student.name}</h3>
                <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white font-bold text-lg">
                    {student.name.charAt(0).toUpperCase()}
                </div>
            </div>
            <div className="mb-2">
                <div className="flex justify-between text-sm text-gray-400 mb-1">
                    <span>Progress: {progressPercentage}%</span>
                    <span>{currentCompleted} / {student.daysToComplete} days</span>
                </div>
                <div className="w-full bg-dark-light rounded-full h-2.5">
                    <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${progressPercentage}%` }}></div>
                </div>
            </div>
            <div className="text-accent text-sm mb-4">Completed Cycles: {cycles}</div>
            
            {user?.role !== 'student' && (
                <div className="border-t border-border-color pt-4 space-y-4">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-300">Days/Cycle:</label>
                        <input type="number" value={days} onChange={e => setDays(parseInt(e.target.value))} className="w-16 px-2 py-1 bg-dark-light border border-border-color rounded-md text-center" />
                        <button onClick={handleUpdateDays} className="bg-primary text-xs font-bold py-1 px-3 rounded-md hover:bg-secondary">Update</button>
                    </div>
                     <button onClick={handleRemoveStudent} className="w-full bg-red-600 text-white font-bold py-2 px-4 rounded-md hover:bg-red-700 transition-colors text-sm">Remove Student</button>
                </div>
            )}
        </div>
    );
};


const ProgressPage = () => {
    const [students, setStudents] = React.useState([]);
    const [isAddModalOpen, setAddModalOpen] = React.useState(false);
    const [newStudentName, setNewStudentName] = React.useState('');
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const [isLoading, setIsLoading] = React.useState(true);
    
    const loadStudents = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await apiService.getStudents();
            setStudents(data);
        } catch (error) {
            addNotification('error', 'Load Failed', 'Could not load student data.');
        } finally {
            setIsLoading(false);
        }
    }, [addNotification]);

    React.useEffect(() => {
        loadStudents();
    }, [loadStudents]);

    const handleAddStudent = async (e) => {
        e.preventDefault();
        if (!newStudentName) return;

        let currentStudents = await apiService.getStudents();
        if (currentStudents.some(s => s.name.toLowerCase() === newStudentName.toLowerCase())) {
            addNotification('error', 'Error', 'A student with this name already exists.');
            return;
        }

        const newStudent = {
            name: newStudentName,
            daysToComplete: 30,
            totalCompleted: 0
        };
        currentStudents.push(newStudent);
        await apiService.saveStudents(currentStudents);
        addNotification('success', 'Student Added', `${newStudentName} has been added.`);
        setNewStudentName('');
        setAddModalOpen(false);
        loadStudents();
    };
    
    if (isLoading) {
        return <div className="text-center p-8"><div className="loader mx-auto"></div></div>
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3"><i className="fas fa-chart-line"></i>Student Progress</h1>
                {user?.role !== 'student' && (
                    <button onClick={() => setAddModalOpen(true)} className="bg-primary text-white font-bold py-2 px-4 rounded-md hover:bg-secondary transition-colors">
                        <i className="fas fa-user-plus mr-2"></i>Add Student
                    </button>
                )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {students.map(student => (
                    <StudentCard key={student.name} student={student} onUpdate={loadStudents} />
                ))}
            </div>
            {students.length === 0 && (
                <div className="text-center py-10 bg-card-bg rounded-lg">
                    <p className="text-gray-400">No students found. Add a student to get started.</p>
                </div>
            )}

            <Modal isOpen={isAddModalOpen} onClose={() => setAddModalOpen(false)} title="Add New Student">
                <form onSubmit={handleAddStudent} className="space-y-4">
                    <div>
                        <label htmlFor="studentName" className="block text-sm font-medium text-gray-300 mb-1">Student Name</label>
                        <input id="studentName" type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} className="w-full px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary" required />
                    </div>
                    <div className="text-right">
                        <button type="submit" className="bg-green-600 text-white font-bold py-2 px-6 rounded-md hover:bg-green-700 transition-colors">
                            Add Student
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

// =======================================================
// --- pages/FeedbackPage.tsx ---
// =======================================================
const FeedbackPage = () => {
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const [feedbacks, setFeedbacks] = React.useState([]);
    const [teachers, setTeachers] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    
    const [teacher, setTeacher] = React.useState('');
    const [subject, setSubject] = React.useState('');
    const [type, setType] = React.useState('');
    const [message, setMessage] = React.useState('');

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const [allUsers, allFeedback] = await Promise.all([
                apiService.getUsers(),
                apiService.getFeedback()
            ]);
            
            setTeachers(allUsers.filter(u => u.role === 'teacher'));
            
            if (user?.role === 'teacher') {
                setFeedbacks(allFeedback.filter(f => f.teacher === user.name));
            } else {
                setFeedbacks(allFeedback);
            }
        } catch (error) {
            addNotification('error', 'Load Failed', 'Could not load feedback data.');
        } finally {
            setIsLoading(false);
        }
    }, [user, addNotification]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!teacher || !subject || !type || !message) {
            addNotification('warning', 'Incomplete Form', 'Please fill out all fields.');
            return;
        }

        const newFeedback = {
            id: Date.now(),
            student: user?.name || 'Anonymous',
            teacher, subject, type, message,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        try {
            const allFeedback = await apiService.getFeedback();
            allFeedback.unshift(newFeedback);
            await apiService.saveFeedback(allFeedback);
            
            addNotification('success', 'Feedback Submitted', 'Thank you for your feedback!');
            setTeacher(''); setSubject(''); setType(''); setMessage('');
            loadData();
        } catch (error) {
             addNotification('error', 'Submit Failed', 'Could not submit feedback.');
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3"><i className="fas fa-comment-dots"></i>Student Feedback</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-card-bg p-6 rounded-lg shadow-lg">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><i className="fas fa-pen"></i>Submit Feedback</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Teacher</label>
                            <select value={teacher} onChange={e => setTeacher(e.target.value)} className="w-full px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                                <option value="">Select a teacher</option>
                                {teachers.map(t => <option key={t.username} value={t.name}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Subject</label>
                            <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                                <option value="">Select a subject</option>
                                <option value="math">Mathematics</option><option value="science">Science</option><option value="english">English</option><option value="history">History</option>
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Feedback Type</label>
                            <select value={type} onChange={e => setType(e.target.value)} className="w-full px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                                <option value="">Select feedback type</option>
                                <option value="suggestion">Suggestion</option><option value="complaint">Complaint</option><option value="compliment">Compliment</option><option value="question">Question</option>
                            </select>
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-gray-300 mb-1">Your Feedback</label>
                             <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} className="w-full px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Enter your feedback..."></textarea>
                        </div>
                        <button type="submit" className="w-full bg-primary text-white font-bold py-2 px-4 rounded-md hover:bg-secondary transition-colors"><i className="fas fa-paper-plane mr-2"></i>Submit</button>
                    </form>
                </div>
                
                {user?.role !== 'student' && (
                     <div className="bg-card-bg p-6 rounded-lg shadow-lg">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><i className="fas fa-list"></i>Recent Feedback</h2>
                        {isLoading ? <div className="loader"></div> : (
                            <div className="space-y-4 max-h-96 overflow-y-auto">
                                {feedbacks.length > 0 ? feedbacks.map(f => (
                                    <div key={f.id} className="bg-dark-light p-4 rounded-md">
                                        <div className="flex justify-between items-start text-sm mb-2">
                                            <div>
                                                <span className="font-bold text-white">{f.student}</span>
                                                <span className="text-gray-400"> to </span>
                                                <span className="font-bold text-white">{f.teacher}</span>
                                            </div>
                                            <div className="text-gray-500 text-xs">{f.date} {f.time}</div>
                                        </div>
                                        <p className="text-gray-300">{f.message}</p>
                                        <div className="text-xs text-gray-400 mt-2">
                                            <span className="capitalize bg-border-color px-2 py-1 rounded-full">{f.subject}</span>
                                            <span className="ml-2 capitalize bg-border-color px-2 py-1 rounded-full">{f.type}</span>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-gray-400">No feedback to display.</p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// =======================================================
// --- pages/UserEditModal.tsx ---
// =======================================================
const UserEditModal = ({ isOpen, onClose, onSave, user, mode }) => {
    const { user: currentUser } = useAuth();
    const [formData, setFormData] = React.useState({ name: '', username: '', role: 'student', password: '' });
    
    React.useEffect(() => {
        if (isOpen) {
            if (mode === 'edit' && user) {
                setFormData({ ...user, password: '' }); 
            } else if (mode === 'addTeacher') {
                setFormData({ name: '', username: '', role: 'teacher', password: '' });
            } else {
                setFormData({ name: '', username: '', role: 'student', password: '' });
            }
        }
    }, [user, isOpen, mode]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    const getModalTitle = () => {
        switch (mode) {
            case 'edit':
                return `Edit ${user?.name}`;
            case 'addTeacher':
                return 'Create Teacher Account';
            case 'addUser':
                return 'Add New User';
            default:
                return 'Manage User';
        }
    };

    const isRoleDisabled = mode === 'addTeacher' || user?.username === currentUser?.username;
    const inputClasses = "w-full px-3 py-2 bg-dark-light border border-border-color rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={getModalTitle()}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="name">Full Name</label>
                    <input id="name" name="name" type="text" value={formData.name} onChange={handleChange} className={inputClasses} required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="username">Username</label>
                    <input id="username" name="username" type="text" value={formData.username} onChange={handleChange} disabled={!!user} className={inputClasses} required />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="password">Password</label>
                    <input id="password" name="password" type="password" value={formData.password || ''} onChange={handleChange} placeholder={user ? "Leave blank to keep unchanged" : "Required"} className={inputClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="role">Role</label>
                    <select id="role" name="role" value={formData.role} onChange={handleChange} className={inputClasses} disabled={isRoleDisabled}>
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-700">Cancel</button>
                    <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-md hover:bg-secondary">Save User</button>
                </div>
            </form>
        </Modal>
    );
};

// =======================================================
// --- pages/UserManagementPage.tsx ---
// =======================================================
const UserManagementPage = () => {
    const [users, setUsers] = React.useState([]);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [selectedUser, setSelectedUser] = React.useState(null);
    const [modalMode, setModalMode] = React.useState('addUser');
    const { addNotification } = useNotification();
    const { user: currentUser } = useAuth();
    const [isLoading, setIsLoading] = React.useState(true);

    const loadUsers = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await apiService.getUsers();
            setUsers(data);
        } catch (error) {
            addNotification('error', 'Load Failed', 'Could not load users.');
        } finally {
            setIsLoading(false);
        }
    }, [addNotification]);

    React.useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const handleAddUser = () => {
        setModalMode('addUser');
        setSelectedUser(null);
        setIsModalOpen(true);
    };
    
    const handleCreateTeacher = () => {
        setModalMode('addTeacher');
        setSelectedUser(null);
        setIsModalOpen(true);
    };

    const handleEditUser = (user) => {
        setModalMode('edit');
        setSelectedUser(user);
        setIsModalOpen(true);
    };

    const handleDeleteUser = async (username) => {
        if (username === currentUser?.username) {
            addNotification('error', 'Action Forbidden', 'You cannot delete your own account.');
            return;
        }

        if (window.confirm(`Are you sure you want to delete user ${username}? This action cannot be undone.`)) {
            const allUsers = await apiService.getUsers();
            const updatedUsers = allUsers.filter(u => u.username !== username);
            await apiService.saveUsers(updatedUsers);
            loadUsers();
            addNotification('success', 'User Deleted', `User ${username} has been deleted.`);
        }
    };

    const handleSaveUser = async (userFromModal) => {
        let allUsers = await apiService.getUsers();
        const isNewUser = !selectedUser;

        if (isNewUser) {
            if (allUsers.some(u => u.username === userFromModal.username)) {
                addNotification('error', 'Error', 'Username already exists.');
                return;
            }
            if (!userFromModal.password) {
                addNotification('error', 'Error', 'Password is required for new users.');
                return;
            }
            allUsers.push(userFromModal);
        } else {
             if (selectedUser?.username === currentUser?.username && userFromModal.role !== 'admin') {
                addNotification('error', 'Action Forbidden', 'You cannot change your own role from admin.');
                return;
            }
            allUsers = allUsers.map(u => {
                if (u.username === selectedUser.username) {
                    const newPassword = userFromModal.password ? userFromModal.password : u.password;
                    return { ...u, ...userFromModal, password: newPassword };
                }
                return u;
            });
        }

        await apiService.saveUsers(allUsers);
        loadUsers();
        setIsModalOpen(false);
        addNotification('success', 'Success', isNewUser ? 'User created successfully.' : 'User updated successfully.');
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3"><i className="fas fa-users-cog"></i>User Management</h1>
                <div className="flex gap-4">
                    <button onClick={handleCreateTeacher} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                        <i className="fas fa-user-plus mr-2"></i>Create Teacher
                    </button>
                    <button onClick={handleAddUser} className="bg-primary text-white font-bold py-2 px-4 rounded-md hover:bg-secondary transition-colors">
                        <i className="fas fa-user-plus mr-2"></i>Add User
                    </button>
                </div>
            </div>
            
            <div className="bg-card-bg p-4 sm:p-6 rounded-lg shadow-lg">
                <div className="overflow-x-auto">
                    {isLoading ? <div className="loader mx-auto"></div> : (
                        <table className="w-full text-left">
                            <thead className="text-xs text-gray-400 uppercase bg-dark-light">
                                <tr>
                                    <th className="p-3">Name</th>
                                    <th className="p-3">Username</th>
                                    <th className="p-3">Role</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.username} className="border-b border-border-color hover:bg-dark-light/50">
                                        <td className="p-3 font-medium text-white">{user.name}</td>
                                        <td className="p-3 text-gray-400">{user.username}</td>
                                        <td className="p-3 capitalize">
                                            <span className={`px-2 py-1 text-xs rounded-full ${
                                                user.role === 'admin' ? 'bg-yellow-500 text-black' :
                                                user.role === 'teacher' ? 'bg-blue-500 text-white' :
                                                'bg-gray-500 text-white'
                                            }`}>{user.role}</span>
                                        </td>
                                        <td className="p-3 text-right space-x-4">
                                            <button onClick={() => handleEditUser(user)} className="text-primary hover:text-accent" title="Edit User"><i className="fas fa-edit"></i></button>
                                            <button onClick={() => handleDeleteUser(user.username)} className="text-red-500 hover:text-red-400" title="Delete User"><i className="fas fa-trash"></i></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                 {users.length === 0 && !isLoading && (
                    <p className="text-center text-gray-400 py-6">No users found.</p>
                )}
            </div>

            <UserEditModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveUser}
                user={selectedUser}
                mode={modalMode}
            />
        </div>
    );
};

// =======================================================
// --- pages/SyllabusPage.tsx ---
// =======================================================
const SyllabusPage = () => {
    const { user } = useAuth();
    const [students, setStudents] = React.useState([]);
    const [selectedStudent, setSelectedStudent] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const { addNotification } = useNotification();

    React.useEffect(() => {
        const loadStudents = async () => {
            if (user && (user.role === 'admin' || user.role === 'teacher')) {
                setIsLoading(true);
                try {
                    const allUsers = await apiService.getUsers();
                    setStudents(allUsers.filter(u => u.role === 'student'));
                } catch (error) {
                    addNotification('error', 'Load Failed', 'Could not load student list.');
                } finally {
                    setIsLoading(false);
                }
            }
        };
        loadStudents();
    }, [user, addNotification]);

    if (!user) {
        return <div className="text-center p-8"><div className="loader mx-auto"></div></div>;
    }

    if (user.role === 'student') {
        return <StudentSyllabusView studentUsername={user.username} viewerRole={user.role} />;
    }
    
    if (isLoading) {
        return <div className="text-center p-8"><div className="loader mx-auto"></div></div>;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                <i className="fas fa-book-reader"></i> Student Syllabi
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {students.map(student => {
                    const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                    return (
                        <div
                            key={student.username}
                            onClick={() => setSelectedStudent(student)}
                            className="bg-card-bg p-5 rounded-lg shadow-lg text-center cursor-pointer transition-transform transform hover:-translate-y-1"
                        >
                            <div className="w-20 h-20 mx-auto rounded-full bg-accent flex items-center justify-center text-white font-bold text-2xl mb-4 overflow-hidden">
                                {student.profileImage 
                                    ? <img src={student.profileImage} alt={student.name} className="w-full h-full object-cover" /> 
                                    : <span>{initials}</span>
                                }
                            </div>
                            <h3 className="text-lg font-bold text-white truncate">{student.name}</h3>
                            <p className="text-sm text-gray-400">@{student.username}</p>
                        </div>
                    );
                })}
            </div>
            {students.length === 0 && (
                <div className="text-center py-10 bg-card-bg rounded-lg">
                    <p className="text-gray-400">No students found in the system.</p>
                </div>
            )}
            
            <Modal
                isOpen={!!selectedStudent}
                onClose={() => setSelectedStudent(null)}
                title={`Syllabus for ${selectedStudent?.name}`}
                maxWidth="max-w-7xl"
            >
                {selectedStudent && (
                    <StudentSyllabusView
                        studentUsername={selectedStudent.username}
                        viewerRole={user.role}
                    />
                )}
            </Modal>
        </div>
    );
};

// =======================================================
// --- App.tsx ---
// =======================================================
const AppContent = () => {
    const { isLoggedIn } = useAuth();
    const [currentPage, setCurrentPage] = React.useState('dashboard');
    
    const navigate = React.useCallback((page) => {
        setCurrentPage(page);
    }, []);

    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return <DashboardPage navigate={navigate} />;
            case 'profile':
                return <ProfilePage />;
            case 'settings':
                return <SettingsPage />;
            case 'timetable':
                return <TimetablePage />;
            case 'progress':
                return <ProgressPage />;
            case 'feedback':
                return <FeedbackPage />;
            case 'user-management':
                return <UserManagementPage />;
            case 'syllabus':
                return <SyllabusPage />;
            default:
                setCurrentPage('dashboard');
                return <DashboardPage navigate={navigate} />;
        }
    };

    return (
        <div className="flex flex-col min-h-screen">
            <Particles />
            <div className="relative z-10 flex flex-col flex-grow">
                {!isLoggedIn ? (
                    <WelcomePage />
                ) : (
                    <React.Fragment>
                        <Header navigate={navigate} />
                        <Navigation currentPage={currentPage} navigate={navigate} />
                        <main className="flex-grow p-4 sm:p-8">
                            <div className="container mx-auto max-w-7xl">
                                {renderPage()}
                            </div>
                        </main>
                        <Footer />
                    </React.Fragment>
                )}
            </div>
            <Notification />
        </div>
    );
};

const App = () => {
    return (
        <NotificationProvider>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </NotificationProvider>
    );
};

// =======================================================
// --- index.tsx ---
// =======================================================
const main = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("Fatal Error: Could not find the root element to mount the application to.");
    return;
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Ensure the app only runs once the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}