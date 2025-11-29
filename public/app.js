function availabilityApp() {
    return {
        loading: true,
        error: null,
        currentUser: null,
        availability: [],
        dates: [],
        selectedDateIndex: 0,
        viewMode: 'individual', // 'individual' or 'overview'
        hours: Array.from({ length: 24 }, (_, i) => i),
        statuses: ['green', 'yellow', 'red'],
        
        init() {
            // Initialize Telegram WebApp (if available)
            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.ready();
                window.Telegram.WebApp.expand();
            } else {
                console.log('Running in development mode (no Telegram WebApp)');
            }
            
            // Calculate date range (today through 7 days later)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            this.dates = [];
            for (let i = 0; i < 8; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() + i);
                this.dates.push(date.toISOString().split('T')[0]);
            }
            
            this.loadUser();
            this.loadAvailability();
        },
        
        async loadUser() {
            try {
                // Get init data if available (Telegram WebApp), otherwise empty (dev mode)
                const initData = window.Telegram?.WebApp?.initData || '';
                const headers = {};
                if (initData) {
                    headers['x-telegram-init-data'] = initData;
                }
                
                const response = await fetch('/api/user', {
                    headers: headers
                });
                
                if (!response.ok) {
                    throw new Error('Failed to load user');
                }
                
                this.currentUser = await response.json();
            } catch (error) {
                console.error('Error loading user:', error);
                this.error = 'Failed to load user data';
            }
        },
        
        async loadAvailability() {
            try {
                const startDate = this.dates[0];
                const endDate = this.dates[this.dates.length - 1];
                
                const response = await fetch(`/api/availability?startDate=${startDate}&endDate=${endDate}`);
                
                if (!response.ok) {
                    throw new Error('Failed to load availability');
                }
                
                const newAvailability = await response.json();
                console.log('[Frontend] loadAvailability - loaded', newAvailability.length, 'items');
                // Replace the entire array to trigger Alpine.js reactivity
                this.availability = newAvailability;
                this.loading = false;
            } catch (error) {
                console.error('Error loading availability:', error);
                this.error = 'Failed to load availability data';
                this.loading = false;
            }
        },
        
        getSlotClass(date, hour) {
            const status = this.getSlotStatus(date, hour);
            return status || 'red'; // Default to red (unavailable)
        },
        
        getSlotStatus(date, hour) {
            const slot = this.getUserSlot(date, hour);
            return slot ? slot.status : 'red'; // Default to red
        },
        
        getUserSlot(date, hour) {
            if (!this.currentUser) return null;
            
            // Normalize date - handle both date strings and timestamps
            const normalizeDate = (d) => {
                if (!d) return '';
                // If it's already a date string (YYYY-MM-DD), return it
                if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    return d;
                }
                // If it's a timestamp, extract the date part
                try {
                    const dateObj = new Date(d);
                    return dateObj.toISOString().split('T')[0];
                } catch (e) {
                    console.error('[Frontend] Error normalizing date:', d, e);
                    return String(d).split('T')[0]; // Fallback: just take the date part
                }
            };
            
            const normalizedDate = normalizeDate(date);
            console.log('[Frontend] getUserSlot:', { 
                date, 
                normalizedDate,
                hour, 
                currentUserId: this.currentUser.user_id,
                availabilityCount: this.availability.length
            });
            
            const slot = this.availability.find(
                a => {
                    const userMatch = String(a.user_id) === String(this.currentUser.user_id);
                    const aDateNormalized = normalizeDate(a.date);
                    const dateMatch = aDateNormalized === normalizedDate;
                    const hourMatch = Number(a.hour) === Number(hour);
                    
                    if (userMatch && dateMatch) {
                        console.log('[Frontend] Found matching user/date:', { 
                            a_user_id: a.user_id, 
                            a_date: a.date,
                            a_date_normalized: aDateNormalized,
                            target_date: normalizedDate,
                            a_hour: a.hour, 
                            target_hour: hour, 
                            hourMatch,
                            status: a.status
                        });
                    }
                    
                    return userMatch && dateMatch && hourMatch;
                }
            );
            
            console.log('[Frontend] getUserSlot result:', slot);
            return slot;
        },
        
        getAllUsersForSlot(date, hour) {
            return this.availability.filter(
                a => a.date === date && a.hour === hour
            );
        },
        
        getAllUsers() {
            // Get unique users from availability data
            const userMap = new Map();
            this.availability.forEach(a => {
                if (!userMap.has(a.user_id)) {
                    userMap.set(a.user_id, {
                        user_id: a.user_id,
                        display_name: a.display_name || 'User'
                    });
                }
            });
            // Always include current user
            if (this.currentUser && !userMap.has(this.currentUser.user_id)) {
                userMap.set(this.currentUser.user_id, {
                    user_id: this.currentUser.user_id,
                    display_name: this.currentUser.display_name || 'User'
                });
            }
            return Array.from(userMap.values()).sort((a, b) => 
                (a.display_name || '').localeCompare(b.display_name || '')
            );
        },
        
        getUserStatus(userId, date, hour) {
            // Normalize date for comparison
            const normalizeDate = (d) => {
                if (!d) return '';
                if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    return d;
                }
                try {
                    const dateObj = new Date(d);
                    return dateObj.toISOString().split('T')[0];
                } catch (e) {
                    return String(d).split('T')[0];
                }
            };
            
            const normalizedDate = normalizeDate(date);
            const slot = this.availability.find(
                a => {
                    const userMatch = String(a.user_id) === String(userId);
                    const aDateNormalized = normalizeDate(a.date);
                    const dateMatch = aDateNormalized === normalizedDate;
                    const hourMatch = Number(a.hour) === Number(hour);
                    return userMatch && dateMatch && hourMatch;
                }
            );
            return slot ? slot.status : 'red'; // Default to red
        },
        
        getUserStatusClass(userId, date, hour) {
            const status = this.getUserStatus(userId, date, hour);
            return status || 'red';
        },
        
        getUserStatusTitle(userId, date, hour) {
            const user = this.getAllUsers().find(u => String(u.user_id) === String(userId));
            const userName = user ? user.display_name : 'User';
            const hourStr = String(hour).padStart(2, '0');
            const status = this.getUserStatus(userId, date, hour);
            return `${userName} - ${this.formatDate(date)} ${hourStr}:00 - ${status.charAt(0).toUpperCase() + status.slice(1)}`;
        },
        
        getSlotContent(date, hour) {
            const allUsers = this.getAllUsersForSlot(date, hour);
            if (allUsers.length === 0) return '';
            
            // Show user names for this slot
            return allUsers.map(u => u.display_name || 'User').join(', ');
        },
        
        getSlotTitle(date, hour) {
            const allUsers = this.getAllUsersForSlot(date, hour);
            const hourStr = String(hour).padStart(2, '0');
            const currentStatus = this.getSlotStatus(date, hour);
            if (allUsers.length === 0) {
                return `${this.formatDate(date)} ${hourStr}:00 - ${currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)} (default)`;
            }
            return `${this.formatDate(date)} ${hourStr}:00 - ${allUsers.map(u => `${u.display_name}: ${u.status}`).join(', ')}`;
        },
        
        async setSlotStatus(date, hour, status) {
            console.log('[Frontend] setSlotStatus called:', { date, hour, status, currentUser: this.currentUser });
            
            if (!this.currentUser) {
                console.error('[Frontend] No current user');
                this.error = 'User not loaded';
                return;
            }
            
            try {
                // Get init data if available (Telegram WebApp), otherwise empty (dev mode)
                const initData = window.Telegram?.WebApp?.initData || '';
                const headers = {
                    'Content-Type': 'application/json'
                };
                if (initData) {
                    headers['x-telegram-init-data'] = initData;
                }
                
                const requestBody = {
                    date,
                    hour,
                    status: status
                };
                console.log('[Frontend] Sending request:', requestBody);
                
                const response = await fetch('/api/availability', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(requestBody)
                });
                
                console.log('[Frontend] Response status:', response.status, response.statusText);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[Frontend] Response error:', errorText);
                    throw new Error('Failed to save availability');
                }
                
                const saved = await response.json();
                console.log('[Frontend] Response data:', saved);
                console.log('[Frontend] Current availability before update:', this.availability.length, 'items');
                
                // If status is 'red', remove the record from local state (it was deleted)
                if (status === 'red' || saved.deleted) {
                    console.log('[Frontend] Deleting record from local state');
                    const index = this.availability.findIndex(
                        a => String(a.user_id) === String(saved.user_id) && 
                             a.date === saved.date && 
                             a.hour === saved.hour
                    );
                    console.log('[Frontend] Found index to delete:', index);
                    if (index >= 0) {
                        this.availability.splice(index, 1);
                        console.log('[Frontend] Record deleted, new availability count:', this.availability.length);
                    } else {
                        console.log('[Frontend] No record found to delete');
                    }
                } else {
                    console.log('[Frontend] Upserting record');
                    // Update or add the record for green/yellow
                    const index = this.availability.findIndex(
                        a => String(a.user_id) === String(saved.user_id) && 
                             a.date === saved.date && 
                             a.hour === saved.hour
                    );
                    
                    console.log('[Frontend] Found index to update:', index);
                    if (index >= 0) {
                        // Use Object.assign to ensure Alpine.js detects the change
                        Object.assign(this.availability[index], saved);
                        console.log('[Frontend] Record updated:', this.availability[index]);
                    } else {
                        // Add user info if missing
                        saved.display_name = this.currentUser.display_name;
                        this.availability.push(saved);
                        console.log('[Frontend] Record added, new availability count:', this.availability.length);
                    }
                }
                
                // Force Alpine.js to react to the change
                this.$nextTick(() => {
                    console.log('[Frontend] Next tick - availability updated');
                });
                
                // Reload to get all users (but keep our local changes)
                console.log('[Frontend] Reloading availability...');
                await this.loadAvailability();
                console.log('[Frontend] Availability reloaded, new count:', this.availability.length);
            } catch (error) {
                console.error('Error saving availability:', error);
                this.error = 'Failed to save availability';
            }
        },
        
        formatDate(dateStr) {
            const date = new Date(dateStr);
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`;
        },
        
        get dateRangeText() {
            if (this.dates.length === 0) return '';
            const start = this.formatDate(this.dates[0]);
            const end = this.formatDate(this.dates[this.dates.length - 1]);
            return `${start} - ${end}`;
        }
    };
}
